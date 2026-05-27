import express from "express";
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
import { upload } from "../middleware/upload.js";
import { uploadMedia } from "../controllers/listingController.js";

const router = express.Router();

// ── Specific named routes FIRST (before /:id wildcards) ──────────────────────
router.get("/mine", protect, getMyListings);
router.get("/notifications", protect, getNotifications);
router.post("/push-token", protect, savePushToken);
router.patch("/notifications/read-all", protect, markAllNotificationsRead);

router.post("/upload", protect, upload.fields([{ name: "images", maxCount: 10 }, { name: "video", maxCount: 1 }]), uploadMedia);

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