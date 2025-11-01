import fs from "fs";
import path from "path";
import http from "http";
import axios from "axios";
import dotenv from "dotenv";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import * as higgsfieldRepository from "../repository/higgsfieldRepository";

dotenv.config();

const HIGGSFIELD_API_URL = "https://api.unifically.com/higgsfield";
const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API;
const httpAgent = new http.Agent({ keepAlive: true });

export const generateVideo = async (apiPayload: any, imageUrls: string[]) => {
  const requestBody = { ...apiPayload, image: imageUrls };
  try {
    const response = await axios.post(
      `${HIGGSFIELD_API_URL}/generate`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HIGGSFIELD_API_KEY}`,
        },
        httpAgent,
      },
    );

    console.log(response.data)

    return response.data;
  } catch (error) {
    logger.error(
      `Error generating video: ${error.response?.data || error.message}`,
    );
    throw new Error("Failed to start video generation.");
  }
};

export const getVideo = async (taskId: string) => {
  try {
    const response = await axios.get(`${HIGGSFIELD_API_URL}/feed/${taskId}`, {
      headers: { Authorization: `Bearer ${HIGGSFIELD_API_KEY}` },
      httpAgent,
    });
    return response.data;
  } catch (error) {
    logger.error(
      `Error getting Higgsfield video status for task ${taskId}: ${error.message}`,
    );
    throw new Error("Failed to get video generation status.");
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
  } catch (error) {
    logger.error(`Error downloading video: ${error.message}`);
    throw new Error("Failed to download video.");
  }
};

export const processFinalVideo = async (
  publish: boolean,
  userId: string,
  videoUrl: string,
  prompt: string,
) => {
  const downloadedVideoPath = await downloadVideo(videoUrl);
  if (publish) {
    return higgsfieldRepository.createPublication({
      userId,
      content: prompt || "Generated Video",
      videoUrl: downloadedVideoPath,
      category: "higgsfield",
    });
  } else {
    return higgsfieldRepository.createGalleryItem({
      userId,
      prompt: prompt || "Generated Video",
      imageUrl: downloadedVideoPath,
      generationType: "video-higgsfield",
    });
  }
};
