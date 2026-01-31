import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

export const uploadsPath = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsPath, { recursive: true });

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsPath);
  },
  filename: (_req, file, cb) => {
    const ext =
      extensionByMime[file.mimetype] ||
      path.extname(file.originalname).toLowerCase() ||
      ".img";
    const uniqueName = `${Date.now()}-${crypto
      .randomBytes(8)
      .toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Tipo de archivo no permitido"));
  }
  return cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});
