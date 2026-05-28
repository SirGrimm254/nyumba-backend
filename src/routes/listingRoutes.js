import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getListings,
  getListingById,
  createListing,
  updateListing,
  toggleVacancy,
  deleteListing,
  getMyListings,
  addReview,
  getReviews,
  editReview,
  deleteReview,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  savePushToken,
} from "../controllers/listingController.js";
import { protect, optionalAuth } from "../middleware/authMiddleware.js";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Multer setup ──────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|mp4|mov|avi/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()))
      cb(null, true);
    else cb(new Error("Only images and videos are allowed"));
  },
});

// ── Upload media — MUST be first before any /:id routes ───────────────────────
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
      res.json({
        uploadedImages: imageFiles.map((f) => `/uploads/${f.filename}`),
        uploadedVideo: videoFiles[0] ? `/uploads/${videoFiles[0].filename}` : null,
      });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  }
);

// ── Specific named routes BEFORE /:id wildcards ───────────────────────────────
router.get("/mine", protect, getMyListings);
router.get("/notifications", protect, getNotifications);
router.post("/push-token", protect, savePushToken);
router.patch("/notifications/read-all", protect, markAllNotificationsRead);

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/", getListings);
router.get("/:id", optionalAuth, getListingById);
router.get("/:id/reviews", getReviews);

// ── Protected ─────────────────────────────────────────────────────────────────
router.post("/", protect, createListing);
router.put("/:id", protect, updateListing);
router.patch("/:id/vacancy", protect, toggleVacancy);
router.patch("/:id/notifications/:notifId/read", protect, markNotificationRead);
router.delete("/:id", protect, deleteListing);
router.post("/:id/reviews", protect, addReview);
router.put("/:id/reviews/:reviewId", protect, editReview);
router.delete("/:id/reviews/:reviewId", protect, deleteReview);

export default router;