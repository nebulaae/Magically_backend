import fs from "fs";
import http from "http";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../../shared/utils/logger";
import * as gptRepository from "../repository/gptRepository";

const GPT_API_URL = "https://api.unifically.com/v1/chat/completions";
const API_KEY = process.env.GPT_API;
const httpAgent = new http.Agent({ keepAlive: true });

export const generateGptImage = async (prompt: string) => {
  const payload = {
    model: "gpt-4o-image-vip",
    messages: [{ role: "user", content: prompt }],
  };

  try {
    const response = await axios.post(GPT_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      httpAgent,
      timeout: 1200000,
    });
    return response.data;
  } catch (error) {
    logger.error(
      `Error generating GPT image: ${error.response?.data || error.message}`,
    );
    throw new Error("Failed to generate image with GPT-4o.");
  }
};

const downloadImage = async (
  imageUrl: string,
  destinationDir: "gpt" | "fal",
): Promise<string> => {
  const imageDir = path.join(
    __dirname,
    `../../../public/images/${destinationDir}`,
  );
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }
  const filename = `${uuidv4()}.png`;
  const outputPath = path.join(imageDir, filename);

  try {
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "stream",
    });
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () =>
        resolve(`/images/${destinationDir}/${filename}`),
      );
      writer.on("error", reject);
    });
  } catch (error) {
    logger.error(
      `Error downloading image to ${destinationDir}: ${error.message}`,
    );
    throw new Error("Failed to download generated image.");
  }
};

export const extractImageUrl = (text: string): string | null => {
  if (!text) return null;
  const regex = /https:\/\/[^\s)]+/;
  const match = text.match(regex);
  return match ? match[0] : null;
};

export const processFinalImage = async (
  publish: boolean,
  userId: string,
  imageUrl: string,
  prompt: string,
) => {
  const localImagePath = await downloadImage(imageUrl, "gpt");
  if (publish) {
    return gptRepository.createPublication({
      userId,
      content: prompt || "Generated Image via GPT-4o",
      imageUrl: localImagePath,
      category: "gpt",
    });
  } else {
    return gptRepository.createGalleryItem({
      userId,
      prompt: prompt || "Generated Image via GPT-4o",
      imageUrl: localImagePath,
      generationType: "image-gpt",
    });
  }
};
