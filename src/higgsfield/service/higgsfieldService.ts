import fs from "fs";
import path from "path";
import http from "http";
import axios from "axios";
import dotenv from "dotenv";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import * as higgsfieldRepository from "../repository/higgsfieldRepository";

dotenv.config();

const HIGGSFIELD_API_URL = "https://api.unifically.com/higgsfield";
const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API;
const httpAgent = new http.Agent({ keepAlive: true });

export const generateVideo = async (payload: {
  prompt: string;
  start_image_url: string;
  end_image_url?: string;
  motion_id: string;
  model: "turbo" | "standard" | "lite";
  enhance_prompt?: boolean;
  seed?: number;
}) => {
  try {
    const response = await axios.post(
      `${HIGGSFIELD_API_URL}/generate`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${HIGGSFIELD_API_KEY}`,
          "Content-Type": "application/json",
        },
        httpAgent,
      }
    );
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message ||
      JSON.stringify(error.response?.data) ||
      error.message;
    logger.error(`Error generating Higgsfield video: ${message}`);
    throw new Error("Failed to start Higgsfield video generation.");
  }
};

export const getVideoStatus = async (taskId: string) => {
  try {
    const response = await axios.get(`${HIGGSFIELD_API_URL}/feed/${taskId}`, {
      headers: { Authorization: `Bearer ${HIGGSFIELD_API_KEY}` },
      httpAgent,
    });
    return response.data;
  } catch (error: any) {
    logger.error(
      `Error fetching Higgsfield task ${taskId} status: ${error.message}`
    );
    throw new Error("Failed to fetch video generation status.");
  }
};

export const getMotions = async (size = 30, cursor?: number) => {
  try {
    const params: Record<string, any> = { size, preset_family: "higgsfield" };
    if (cursor) params.cursor = cursor;

    const response = await axios.get(`${HIGGSFIELD_API_URL}/motions`, {
      headers: { Authorization: `Bearer ${HIGGSFIELD_API_KEY}` },
      params,
      httpAgent,
    });

    return response.data;
  } catch (error: any) {
    logger.error(`Error fetching Higgsfield motions: ${error.message}`);
    throw new Error("Failed to fetch Higgsfield motion presets.");
  }
};

const downloadVideo = async (videoUrl: string): Promise<string> => {
  const videoDir = path.join(__dirname, "../../../public/videos/higgsfield");
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

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
      writer.on("finish", () => resolve(`/videos/higgsfield/${filename}`));
      writer.on("error", reject);
    });
  } catch (error: any) {
    logger.error(`Error downloading video: ${error.message}`);
    throw new Error("Failed to download video file.");
  }
};

export const processFinalVideo = async (
  publish: boolean,
  userId: string,
  videoUrl: string,
  prompt: string,
  t: Transaction
) => {
  const localPath = await downloadVideo(videoUrl);
  if (publish) {
    return higgsfieldRepository.createPublication({
      userId,
      content: prompt || "Generated Video via Higgsfield",
      videoUrl: localPath,
      category: "higgsfield",
    }, t);
  } else {
    return higgsfieldRepository.createGalleryItem({
      userId,
      prompt: prompt || "Generated Video via Higgsfield",
      imageUrl: localPath,
      generationType: "video-higgsfield",
    }, t);
  }
};
