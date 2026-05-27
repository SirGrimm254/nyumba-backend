import express from "express";
import { registerUser, loginUser, uploadMedia, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes
router.get("/me", protect, getMe);
router.post("/upload-avatar", protect, upload.single("avatar"), uploadMedia);

router.get("/test", (req, res) => res.send("Auth route working"));

export default router;