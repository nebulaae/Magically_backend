import fs from "fs";
import path from "path";
import http from "http";
import axios from "axios";
import dotenv from "dotenv";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import * as klingRepository from "../repository/klingRepository";

dotenv.config();

const KLING_API_URL = "https://api.unifically.com/kling-v2-5-turbo";
const KLING_API_KEY = process.env.KLING_API;
const httpAgent = new http.Agent({ keepAlive: true });

interface KlingGenerationPayload {
  prompt: string;
  duration: number;
  mode: "std" | "pro";
  image_url?: string;
}

export const generateKlingVideo = async (payload: KlingGenerationPayload) => {
  try {
    const response = await axios.post(`${KLING_API_URL}/generate`, payload, {
      headers: {
        Authorization: `Bearer ${KLING_API_KEY}`,
        "Content-Type": "application/json",
      },
      httpAgent,
    });

    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error(`Error generating Kling video: ${errorMessage}`);
    throw new Error("Failed to start Kling video generation.");
  }
};

export const getKlingVideoStatus = async (taskId: string) => {
  try {
    const response = await axios.get(`${KLING_API_URL}/status/${taskId}`, {
      headers: { Authorization: `Bearer ${KLING_API_KEY}` },
      httpAgent,
      validateStatus: () => true,
    });
    return response.data;
  } catch (error: any) {
    logger.error(
      `Error getting Kling video status for task ${taskId}: ${error.response?.data || error.message}`,
    );
    if (error.response && error.response.data) {
      return error.response.data;
    }
    throw new Error("Failed to get Kling video generation status.");
  }
};

const downloadKlingVideo = async (videoUrl: string): Promise<string> => {
  const videoDir = path.join(__dirname, "../../../public/videos/kling");
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const filename = `${uuidv4()}.mp4`;
  const outputPath = path.join(videoDir, filename);

  try {
    const response = await axios({
      method: "GET",
      url: videoUrl,
      responseType: "stream",
    });
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(`/videos/kling/${filename}`));
      writer.on("error", reject);
    });
  } catch (error) {
    logger.error(`Error downloading Kling video: ${error.message}`);
    throw new Error("Failed to download Kling video.");
  }
};

export const processFinalVideo = async (
  publish: boolean,
  userId: string,
  videoUrl: string,
  prompt: string,
) => {
  const downloadedVideoPath = await downloadKlingVideo(videoUrl);
  if (publish) {
    return klingRepository.createPublication({
      userId,
      content: prompt || "Generated Video",
      videoUrl: downloadedVideoPath,
      category: "kling",
    });
  } else {
    return klingRepository.createGalleryItem({
      userId,
      prompt: prompt || "Generated Video",
      imageUrl: downloadedVideoPath,
      generationType: "video-kling",
    });
  }
};