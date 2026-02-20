import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger';
import * as paymentService from '../service/paymentService';
import * as bePaidService from '../service/bePaidService';
import * as apiResponse from '../../../shared/utils/apiResponse';

// Обрабатывает webhook уведомление от bePaid
export const handleBePaidWebhook = async (req: Request, res: Response) => {
  try {
    // Получаем raw body для проверки подписи (сохранен в middleware в main.ts)
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.error('BePaid webhook: rawBody is missing');
      return res.status(400).json({
        success: false,
        message: 'Raw body is required for signature verification',
      });
    }
    const signature = req.headers['content-signature'] as string;

    if (!signature) {
      logger.warn('BePaid webhook: Content-Signature header is missing');
      // В тестовом режиме можно пропустить проверку подписи
      if (process.env.NODE_ENV === 'production') {
        return apiResponse.unauthorized(
          res,
          'Missing Content-Signature header'
        );
      }
    } else {
      // Проверяем цифровую подпись (rawBody всегда Buffer после middleware)
      const isValidSignature = bePaidService.verifyWebhookSignature(
        rawBody,
        signature
      );

      if (!isValidSignature) {
        logger.warn('BePaid webhook: Invalid signature');
        // В тестовом режиме можно пропустить проверку подписи
        if (process.env.NODE_ENV === 'production') {
          return apiResponse.unauthorized(res, 'Invalid signature');
        }
      }
    }

    // Парсим JSON из raw body (rawBody всегда Buffer в нашем случае)
    const webhookData: bePaidService.BePaidWebhookNotification = JSON.parse(
      rawBody.toString('utf8')
    );

    logger.info(
      `BePaid webhook received: ${JSON.stringify(webhookData, null, 2)}`
    );

    // Обрабатываем webhook
    const result = await paymentService.handleBePaidWebhook(webhookData);

    if (result.success) {
      // Возвращаем HTTP 200 для успешной обработки (требование bePaid)
      return res.status(200).json({ success: true, message: result.message });
    } else {
      logger.error(`BePaid webhook processing failed: ${result.message}`);
      // Все равно возвращаем 200, чтобы bePaid не повторял запрос
      // Но логируем ошибку для дальнейшего анализа
      return res.status(200).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error: any) {
    logger.error(`Error handling BePaid webhook: ${error.message}`);
    // Возвращаем 200, чтобы bePaid не повторял запрос при ошибке парсинга
    // Но логируем ошибку
    return res.status(200).json({
      success: false,
      message: `Error processing webhook: ${error.message}`,
    });
  }
};
