import fs from "fs";
import path from "path";
import http from "http";
import axios from "axios";
import dotenv from "dotenv";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import * as klingRepository from "../repository/klingRepository";

dotenv.config();

const KLING_API_URL = "https://api.unifically.com/kling/v1/videos";
const KLING_API_KEY = process.env.KLING_API;
const httpAgent = new http.Agent({ keepAlive: true });

interface KlingGenerationPayload {
  model: string;
  image_url: string;
  prompt: string;
  duration: number;
  aspect_ratio: string;
  negative_prompt?: string;
  effect?: string;
}

export const generateKlingVideo = async (payload: KlingGenerationPayload) => {
  try {
    const response = await axios.post(`${KLING_API_URL}/generations`, payload, {
      headers: {
        Authorization: `Bearer ${KLING_API_KEY}`,
        "Content-Type": "application/json",
      },
      httpAgent,
    });

    console.log(response.data)

    return response.data;
  } catch (error) {
    logger.error(
      `Error generating Kling video: ${error.response?.data || error.message}`,
    );
    throw new Error("Failed to start Kling video generation.");
  }
};

export const getKlingVideoStatus = async (taskId: string) => {
  try {
    // Don't throw on non-2xx so we can inspect API error bodies (curl shows 400 with useful JSON).
    const response = await axios.get(`${KLING_API_URL}/generations/${taskId}`, {
      headers: { Authorization: `Bearer ${KLING_API_KEY}` },
      httpAgent,
      validateStatus: () => true,
    });
    return response.data;
  } catch (error: any) {
    // Network / unexpected errors
    logger.error(
      `Error getting Kling video status for task ${taskId}: ${error.response?.data || error.message}`,
    );
    if (error.response && error.response.data) {
      // Return API body when present so caller can react to failed tasks
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
