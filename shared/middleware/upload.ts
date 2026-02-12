import fs from 'fs';
import path from 'path';
import multer from 'multer';

import { Request } from 'express';
import { publicDir } from '../utils/paths';
import { s3Storage } from '../config/s3Storage';

// Define the destinations for directories
export const gptDir = publicDir('ai', 'gpt');
export const nanoDir = publicDir('ai', 'nano');
export const fluxDir = publicDir('ai', 'flux');
export const klingDir = publicDir('ai', 'kling');
export const ttapiDir = publicDir('ai', 'ttapi');
export const aiModelsDir = publicDir('ai', 'models');
export const avatarDir = publicDir('users', 'avatars');
export const higgsfieldDir = publicDir('ai', 'higgsfield');
export const publicationDir = publicDir('publications');

const useS3 = process.env.USE_S3 === 'true';

// Ensure directories exist (only if not using S3)
if (!useS3) {
  [
    gptDir,
    nanoDir,
    fluxDir,
    klingDir,
    ttapiDir,
    avatarDir,
    aiModelsDir,
    higgsfieldDir,
    publicationDir,
  ].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// File filter to only accept image files
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|gif|heic|heif/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(
    new Error(
      'Error: File upload only supports the following filetypes - ' +
        allowedTypes
    )
  );
};

// File filter to accept both image and video files
const imageAndVideoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedImageTypes = /jpeg|jpg|png|gif/;
  const allowedVideoTypes = /mp4|mov|avi|webm|mkv/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype;

  if (
    allowedImageTypes.test(ext) ||
    allowedVideoTypes.test(ext) ||
    mimetype.startsWith('image/') ||
    mimetype.startsWith('video/')
  ) {
    return cb(null, true);
  }
  cb(
    new Error(
      'Error: File upload only supports image and video filetypes - jpeg, jpg, png, gif, mp4, mov, avi, webm, mkv'
    )
  );
};

// Avatar upload storage
export const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, avatarDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: fileFilter,
}).single('avatar');

// Storage to upload publications
export const uploadPublicationImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, publicationDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: imageAndVideoFileFilter,
}).single('publicationMedia');

// Storage to upload image to kling
export const uploadKlingImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, klingDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `kling-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).single('klingImage');

// Storage to upload images to higgsfield
export const uploadHiggsfieldImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, higgsfieldDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `higgsfield-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).array('higgsfieldImage', 2);

export const uploadTtapiModelImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, ttapiDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `ttapi-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter,
}).array('modelImages', 8);

export const uploadFluxModelImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, fluxDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `flux-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter,
}).array('modelImages', 8);

export const uploadNanoImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, nanoDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `nano-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).single('nanoImage');

export const uploadGptImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, gptDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `gpt-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).single('gptImages');

export const uploadAIModelImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, aiModelsDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `ai-model-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter,
}).array('modelImages', 8);

/**
 * Helper function to handle file upload after multer processing
 * Use this in your controllers/services to upload to S3
 */
export const handleFileUpload = async (
  file: Express.Multer.File,
  directory: string
): Promise<string> => {
  if (useS3) {
    const result = await s3Storage.uploadFile(file, directory);
    return result.url;
  }
  // Return local path
  return `/${directory}/${file.filename}`;
};

/**
 * Helper function to handle multiple files upload
 */
export const handleFilesUpload = async (
  files: Express.Multer.File[],
  directory: string
): Promise<string[]> => {
  if (useS3) {
    const results = await s3Storage.uploadFiles(files, directory);
    return results.map((r) => r.url);
  }
  // Return local paths
  return files.map((f) => `/${directory}/${f.filename}`);
};

/**
 * Helper function to delete file
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  await s3Storage.deleteFile(filePath);
};

/**
 * Helper function to delete multiple files
 */
export const deleteFiles = async (filePaths: string[]): Promise<void> => {
  await s3Storage.deleteFiles(filePaths);
};