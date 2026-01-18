import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import { logger } from "../../../shared/utils/logger";
import * as gptRepository from "../repository/gptRepository";
import { publicDir } from "../../../shared/utils/paths";

dotenv.config()

const API_KEY = process.env.GPT_API;

export const generateGptImage = async (data: any, isVersion1_5: boolean = false) => {
  const endpoint = isVersion1_5 ? "gpt-image-1.5" : "gpt-image-1";
  const url = `https://api.unifically.com/${endpoint}/generate`;

  return axios.post(url, data, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    }
  });
};

export const getGptImageStatus = async (taskId: string, isVersion1_5: boolean = false) => {
  const endpoint = isVersion1_5 ? "gpt-image-1.5" : "gpt-image-1";
  const url = `https://api.unifically.com/${endpoint}/status/${taskId}`;

  return axios.get(url, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`
    }
  });
};

const downloadImage = async (
  imageUrl: string,
  destinationDir: "gpt" | "fal",
): Promise<string> => {
  const imageDir = publicDir("images", destinationDir);

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
  t: Transaction
) => {
  const localImagePath = await downloadImage(imageUrl, "gpt");

  if (publish) {
    return gptRepository.createPublication({
      userId,
      content: prompt || "Generated Image via GPT-4o",
      imageUrl: localImagePath,
      category: "gpt",
    }, t);
  } else {
    return gptRepository.createGalleryItem({
      userId,
      prompt: prompt || "Generated Image via GPT-4o",
      imageUrl: localImagePath,
      generationType: "image-gpt",
    }, t);
  }
};