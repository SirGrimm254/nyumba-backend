import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import User from "./models/User.js";
import jwt from "jsonwebtoken";
import https from "https";
import uploadRoutes from "./routes/uploadRoutes.js";
import fs from "fs";

dotenv.config();
connectDB();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => res.send("Nyumba API Running..."));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── Google Auth ──────────────────────────────────────────────────────────────
app.post("/api/auth/google", async (req, res) => {
  try {
    const { accessToken, role } = req.body;
    if (!accessToken || !role)
      return res.status(400).json({ message: "accessToken and role are required" });

    // Verify token with Google and get user info
    const { data } = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!data.email)
      return res.status(400).json({ message: "Could not get email from Google" });

    // Find or create user
    let user = await User.findOne({ email: data.email, role });

    if (!user) {
      user = await User.create({
        fullName: data.name,
        email: data.email,
        role,
        googleId: data.sub,
        avatar: data.picture,
        // Set a random password since Google users won't use it
        password: data.sub + process.env.JWT_SECRET,
      });
    } else {
      // Update googleId if they registered manually before
      if (!user.googleId) {
        user.googleId = data.sub;
        await user.save();
      }
    }

    // Generate JWT — same shape as your /login response
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("Google auth error:", error.message);
    res.status(500).json({ message: "Google sign-in failed" });
  }
});

// ── Keep alive ───────────────────────────────────────────────────────────────
setInterval(() => {
  https.get("https://nyumba-backend-jor8.onrender.com/health", (res) => {
    console.log("Keep-alive ping:", res.statusCode);
  }).on("error", () => {});
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));