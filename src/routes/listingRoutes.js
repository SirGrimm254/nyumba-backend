import express from "express";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
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

const router = express.Router();

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Cloudinary storage ────────────────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "nyumba",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi"],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ── Upload media ──────────────────────────────────────────────────────────────
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
        // Cloudinary gives full https:// URL in file.path
        uploadedImages: imageFiles.map((f) => f.path),
        uploadedVideo: videoFiles[0] ? videoFiles[0].path : null,
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