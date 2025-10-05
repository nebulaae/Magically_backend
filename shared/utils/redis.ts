import express from "express";

export const createCacheKey = (req: express.Request) => {
  const { originalUrl } = req;
  const userId = req.user?.id || "public"; // Differentiate cache for different users if needed
  return `${userId}:${originalUrl}`;
};
