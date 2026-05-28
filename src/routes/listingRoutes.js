import express from "express";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import {
  getListings, getListingById, createListing, updateListing,
  toggleVacancy, deleteListing, getMyListings,
  addReview, getReviews, editReview, deleteReview,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  savePushToken,
} from "../controllers/listingController.js";
import { protect, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Temporary debug log — remove after fixing
console.log("Cloudinary config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET ? "SET" : "MISSING",
});

// ── Multer — memory storage (no disk, works on Render) ───────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|mp4|mov|avi/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

// ── Helper: upload buffer to Cloudinary ──────────────────────────────────────
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "nyumba", ...options },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

// ── Upload media route ────────────────────────────────────────────────────────
router.post(
  "/upload-media",
  protect,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "video",  maxCount: 1  },
  ]),
  async (req, res) => {
    try {
      const imageFiles = req.files?.images ?? [];
      const videoFiles = req.files?.video  ?? [];

      // Upload all images in parallel
      const imageResults = await Promise.all(
        imageFiles.map((f) =>
          uploadToCloudinary(f.buffer, { resource_type: "image" })
        )
      );

      // Upload video if present
      let videoUrl = null;
      if (videoFiles[0]) {
        const videoResult = await uploadToCloudinary(videoFiles[0].buffer, {
          resource_type: "video",
        });
        videoUrl = videoResult.secure_url;
      }

      res.json({
        uploadedImages: imageResults.map((r) => r.secure_url),
        uploadedVideo: videoUrl,
      });
    } catch (e) {
      console.error("Upload error full:", JSON.stringify(e));
      res.status(500).json({ 
        message: e.message || e.error?.message || JSON.stringify(e) 
      });
    }
  }
);

// ── Specific named routes BEFORE /:id wildcards ───────────────────────────────
router.get("/mine",                          protect,       getMyListings);
router.get("/notifications",                 protect,       getNotifications);
router.post("/push-token",                   protect,       savePushToken);
router.patch("/notifications/read-all",      protect,       markAllNotificationsRead);

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/",            getListings);
router.get("/:id",         optionalAuth, getListingById);
router.get("/:id/reviews", getReviews);

// ── Protected ─────────────────────────────────────────────────────────────────
router.post("/",                                    protect, createListing);
router.put("/:id",                                  protect, updateListing);
router.patch("/:id/vacancy",                        protect, toggleVacancy);
router.patch("/:id/notifications/:notifId/read",    protect, markNotificationRead);
router.delete("/:id",                               protect, deleteListing);
router.post("/:id/reviews",                         protect, addReview);
router.put("/:id/reviews/:reviewId",                protect, editReview);
router.delete("/:id/reviews/:reviewId",             protect, deleteReview);

export default router;