import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";

dotenv.config();

connectDB();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.get("/", (req, res) => {
  res.send("Nyumba API Running...");
});

app.post("/auth/google", async (req, res) => {
  const { accessToken, role } = req.body;

  // Verify token and get user info from Google
  const { data } = await axios.get(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  // data = { email, name, picture, sub (googleId) }
  let user = await User.findOne({ email: data.email, role });

  if (!user) {
    // Auto-register them
    user = await User.create({
      fullName: data.name,
      email: data.email,
      role,
      googleId: data.sub,
      avatar: data.picture,
    });
  }

  // Return same shape as your /login response
  res.json({ token: generateJWT(user), user });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});