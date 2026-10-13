/**
 * Multipart uploads: images in memory (handed to uploadService), 3D models to a temp file
 * on disk so large uploads can be optimized without holding them in server memory.
 */

import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { extname } from 'path';
import multer from 'multer';

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

/** Raw 3D exports can be large; they are optimized for phones before storage. */
export const MAX_MODEL_UPLOAD_MB = 300;

const modelUpload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (req, file, cb) => cb(null, `model-upload-${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_MODEL_UPLOAD_MB * 1024 * 1024 },
});

/** Single 3D model file in field "file", saved to a temp path (req.file.path). */
export function modelFileUpload(req, res, next) {
  modelUpload.single('file')(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `The 3D file is over ${MAX_MODEL_UPLOAD_MB} MB. Export a lighter version and try again.`,
      });
    }
    next(error);
  });
}
