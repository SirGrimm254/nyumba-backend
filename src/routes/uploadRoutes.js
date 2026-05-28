import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|mp4|mov|avi/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error("Only images and videos are allowed"));
  },
});

router.post(
  "/upload-media",
  protect,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "video", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const imageFiles = req.files?.images ?? [];
      const videoFiles = req.files?.video ?? [];

      const uploadedImages = imageFiles.map(
        (f) => `https://nyumba-backend-jor8.onrender.com/uploads/${f.filename}`
      );
      const uploadedVideo = videoFiles[0]
        ? `https://nyumba-backend-jor8.onrender.com/uploads/${videoFiles[0].filename}`
        : null;

      res.json({ uploadedImages, uploadedVideo });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);

export default router;