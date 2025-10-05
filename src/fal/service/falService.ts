import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { fal } from "@fal-ai/client";
import * as falRepository from "../repository/falRepository";

dotenv.config();

fal.config({
  credentials: process.env.FAL_API,
});

export const processWithFalClient = async (modelId: string, input: any) => {
  try {
    const result: any = await fal.subscribe(modelId, {
      input: input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => console.log(`[Fal AI Log]: ${log.message}`));
        }
      },
    });
    return result;
  } catch (error) {
    console.error("Error during Fal AI client subscription:", error);
    throw new Error("Failed to process request with Fal AI client.");
  }
};

const downloadFalImage = async (imageUrl: string): Promise<string> => {
  const imageDir = path.join(__dirname, `../../../public/images/fal`);
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
      writer.on("finish", () => resolve(`/images/fal/${filename}`));
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading image to fal:`, error);
    throw new Error("Failed to download generated image.");
  }
};

export const processFinalImage = async (
  publish: boolean,
  userId: string,
  imageUrl: string,
  prompt: string,
) => {
  const localImagePath = await downloadFalImage(imageUrl);
  if (publish) {
    return falRepository.createPublication({
      userId,
      content: prompt || "Generated Image via Fal AI",
      imageUrl: localImagePath,
      category: "fal-ai",
    });
  } else {
    return falRepository.createGalleryItem({
      userId,
      prompt: prompt || "Generated Image via Fal AI",
      imageUrl: localImagePath,
      generationType: "image-fal",
    });
  }
};
