import fs from "fs";
import path from "path";
import multer from "multer";
import { Request } from "express";

// Define the destinations for directories
export const falDir = path.join(__dirname, "../../public/ai/fal");
export const klingDir = path.join(__dirname, "../../public/ai/kling");
export const nanoDir = path.join(__dirname, "../../public/ai/nano");
export const avatarDir = path.join(__dirname, "../../public/users/avatars");
export const privateDir = path.join(__dirname, "../../private/user_uploads");
export const higgsfieldDir = path.join(__dirname, "../../public/ai/higgsfield");
export const publicationDir = path.join(__dirname, "../../public/publications");
export const replicateDir = path.join(__dirname, "../../public/ai/replicate");

// Ensure directories exist
[
  falDir,
  nanoDir,
  klingDir,
  avatarDir,
  privateDir,
  higgsfieldDir,
  publicationDir,
  replicateDir,
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});



// File filter to only accept image files
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(
    new Error(
      "Error: File upload only supports the following filetypes - " +
      allowedTypes,
    ),
  );
};

// File filter to accept both image and video files
const imageAndVideoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedImageTypes = /jpeg|jpg|png|gif/;
  const allowedVideoTypes = /mp4|mov|avi|webm|mkv/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const mimetype = file.mimetype;

  if (
    allowedImageTypes.test(ext) ||
    allowedVideoTypes.test(ext) ||
    mimetype.startsWith("image/") ||
    mimetype.startsWith("video/")
  ) {
    return cb(null, true);
  }
  cb(
    new Error(
      "Error: File upload only supports image and video filetypes - jpeg, jpg, png, gif, mp4, mov, avi, webm, mkv",
    ),
  );
};

// Avatar upload storage
export const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, avatarDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: fileFilter,
}).single("avatar");

// Storage to upload publications
export const uploadPublicationImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, publicationDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: imageAndVideoFileFilter,
}).single("publicationMedia");

// Storage to upload image to falai
export const uploadFalImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, falDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `kling-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).single("falImage");

// Storage to upload image to kling
export const uploadKlingImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, klingDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `kling-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).single("klingImage");

// Storage to upload images to higgsfield
export const uploadHiggsfieldImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, higgsfieldDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `higgsfield-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).array("higgsfieldImage", 10);

// Storage for Replicate training images
export const uploadReplicateImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, replicateDir);
    },
    filename: (req, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `replicate-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB total might be needed
  fileFilter: fileFilter,
}).array("replicateImages", 15);

export const uploadNanoImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, nanoDir);
    },
    filename: (req: Request, file, cb) => {
      const userId = req.user.id;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `nano-${userId}-${uniqueSuffix}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter,
}).single("nanoImage");