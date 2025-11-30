import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as gptService from "../service/gptService";
import * as apiResponse from "../../../shared/utils/apiResponse";

// Функция ожидания
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateImage = async (req: Request, res: Response) => {
  // Увеличиваем таймаут запроса до 15 минут
  req.setTimeout(900000);

  const { prompt, publish } = req.body; // publish теперь приходит сразу
  const userId = req.user.id;
  const isPublish = publish === 'true' || publish === true;

  if (!prompt) {
    return apiResponse.badRequest(res, "Prompt is required.");
  }

  const t = await db.transaction();

  try {
    // 1. Списание токенов
    await deductTokensForGeneration(userId, "image", t);

    // 2. Запрос к Unifically
    const gptResponse = await gptService.generateGptImage(prompt);

    let finalImageUrl: string | null = null;

    // Пытаемся достать URL сразу (если модель быстрая)
    try {
      if (gptResponse?.choices && Array.isArray(gptResponse.choices) && gptResponse.choices.length) {
        const rawImageUrl = gptResponse.choices[0]?.message?.content;
        finalImageUrl = gptService.extractImageUrl(rawImageUrl);
      }
    } catch (e) {
      finalImageUrl = null;
    }

    // Если сразу URL нет, идем в поллинг
    if (!finalImageUrl) {
      let taskId = gptResponse?.data_id || gptResponse?.task_id || gptResponse?.data?.task_id || gptResponse?.id;

      if (!taskId) {
        // Попытка распарсить, если пришла строка
        try {
          if (typeof gptResponse === "string") {
            const parsed = JSON.parse(gptResponse);
            taskId = parsed.task_id || parsed.data_id;
          }
        } catch (e) { }
      }

      if (!taskId) throw new Error("Failed to get task ID from GPT API");

      // 3. Поллинг статуса (до 60 попыток по 5 секунд = 5 минут, можно увеличить)
      for (let attempts = 0; attempts < 120; attempts++) {
        await sleep(5000);
        const statusResponse = await gptService.getGptImageStatus(taskId);
        const status = statusResponse?.data?.status || statusResponse?.status;

        if (status === "completed") {
          finalImageUrl = statusResponse?.data?.output?.image_url || statusResponse?.data?.image_url || null;
          break;
        } else if (status === "failed") {
          throw new Error(statusResponse?.data?.error?.message || "GPT generation failed");
        }
      }
    }

    if (!finalImageUrl) throw new Error("Generation timed out or returned no image.");

    // 4. Скачивание и сохранение (Логика из processImage перенесена сюда)
    const resultItem = await gptService.processFinalImage(
      isPublish,
      userId,
      finalImageUrl,
      prompt,
      t // Передаем транзакцию, чтобы все было атомарно
    );

    // 5. Коммит транзакции (только если все шаги успешны)
    await t.commit();

    apiResponse.success(res, resultItem, "Image generated and saved successfully.");

  } catch (error) {
    await t.rollback();
    logger.error(`GPT Generation Error: ${error.message}`);
    apiResponse.internalError(res, error.message || "Generation failed.");
  }
};