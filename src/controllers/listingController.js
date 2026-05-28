import Listing from "../models/Listing.js";
import User from "../models/User.js";

// ── Helper: send Expo push notification ───────────────────────────────────────
async function sendPushNotification(expoPushToken, title, body) {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: "default",
        title,
        body,
        data: { type: "review" },
        priority: "high",
      }),
    });
  } catch (err) {
    console.log("Push notification error:", err.message);
  }
}

// ── GET all listings ──────────────────────────────────────────────────────────
const getListings = async (req, res) => {
  try {
    const listings = await Listing.find()
      .populate("landlord", "fullName phone profileImage")
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET single listing + unique view count ────────────────────────────────────
const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate("landlord", "fullName phone profileImage");
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    const userId = req.user?._id;
    if (userId) {
      const alreadyViewed = listing.viewedBy.some(
        (id) => id.toString() === userId.toString()
      );
      if (!alreadyViewed) {
        listing.viewedBy.push(userId);
        listing.views += 1;
        await listing.save();
      }
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST create listing ───────────────────────────────────────────────────────
const createListing = async (req, res) => {
  try {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ message: "Only landlords can post listings." });
    }

    const body = { ...req.body, landlord: req.user._id };

    // Accept both Cloudinary full URLs and legacy relative /uploads/ paths
    if (body.images) {
      body.images = body.images.filter(
        (img) =>
          typeof img === "string" &&
          (img.startsWith("/uploads/") || img.startsWith("https://"))
      );
    }
    if (
      body.video &&
      !body.video.startsWith("/uploads/") &&
      !body.video.startsWith("https://")
    ) {
      delete body.video;
    }

    const listing = await Listing.create(body);
    await listing.populate("landlord", "fullName phone profileImage");
    res.status(201).json(listing);
  } catch (err) {
    res.status(400).json({ message: "Failed to create listing", error: err.message });
  }
};

// ── PUT update listing ────────────────────────────────────────────────────────
const updateListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.landlord.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised" });

    const body = { ...req.body };

    // Accept both Cloudinary full URLs and legacy relative /uploads/ paths
    if (body.images) {
      body.images = body.images.filter(
        (img) =>
          typeof img === "string" &&
          (img.startsWith("/uploads/") || img.startsWith("https://"))
      );
    }
    if (
      body.video &&
      !body.video.startsWith("/uploads/") &&
      !body.video.startsWith("https://")
    ) {
      delete body.video;
    }

    const updated = await Listing.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    }).populate("landlord", "fullName phone profileImage");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Update failed", error: err.message });
  }
};

// ── PATCH toggle vacancy ──────────────────────────────────────────────────────
const toggleVacancy = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.landlord.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised" });

    listing.isVacant = !listing.isVacant;
    await listing.save();
    res.json({ isVacant: listing.isVacant });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── DELETE listing ────────────────────────────────────────────────────────────
const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.landlord.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised" });

    await listing.deleteOne();
    res.json({ message: "Listing deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET my listings ───────────────────────────────────────────────────────────
const getMyListings = async (req, res) => {
  try {
    const listings = await Listing.find({ landlord: req.user._id })
      .populate("viewedBy", "fullName email")
      .populate("landlord", "fullName phone profileImage")
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST submit a review ──────────────────────────────────────────────────────
const addReview = async (req, res) => {
  try {
    const { rating, text } = req.body;
    if (!rating || !text) return res.status(400).json({ message: "Rating and text required" });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    const already = listing.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (already) return res.status(400).json({ message: "You already reviewed this listing" });

    listing.reviews.push({ user: req.user._id, rating, text });

    const total = listing.reviews.reduce((s, r) => s + r.rating, 0);
    listing.averageRating = +(total / listing.reviews.length).toFixed(1);
    listing.enquiries += 1;

    listing.notifications.push({
      type: "review",
      fromUser: req.user._id,
      fromName: req.user.fullName,
      message: `${req.user.fullName} reviewed "${listing.title}" — ${rating}★`,
      read: false,
      createdAt: new Date(),
    });

    await listing.save();

    const landlord = await User.findById(listing.landlord);
    if (landlord?.expoPushToken) {
      await sendPushNotification(
        landlord.expoPushToken,
        "New Review on Your Listing! ⭐",
        `${req.user.fullName} gave ${rating} star${rating > 1 ? "s" : ""} on "${listing.title}"`
      );
    }

    res.status(201).json({
      averageRating: listing.averageRating,
      reviewCount: listing.reviews.length,
      enquiries: listing.enquiries,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET reviews for a listing ─────────────────────────────────────────────────
const getReviews = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate("reviews.user", "fullName profileImage");
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    res.json({
      reviews: listing.reviews,
      averageRating: listing.averageRating,
      enquiries: listing.enquiries,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET notifications for landlord ────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const listings = await Listing.find({ landlord: req.user._id })
      .select("title notifications")
      .sort({ createdAt: -1 });

    const allNotifications = [];
    listings.forEach((listing) => {
      listing.notifications.forEach((notif) => {
        allNotifications.push({
          _id: notif._id.toString(),
          listingId: listing._id.toString(),
          listingTitle: listing.title,
          type: notif.type,
          fromName: notif.fromName,
          message: notif.message,
          read: notif.read,
          createdAt: notif.createdAt,
        });
      });
    });

    allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unreadCount = allNotifications.filter((n) => !n.read).length;

    res.json({ notifications: allNotifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── PATCH mark single notification as read ────────────────────────────────────
const markNotificationRead = async (req, res) => {
  try {
    const { listingId, notifId } = req.params;

    const listing = await Listing.findOne({
      _id: listingId,
      landlord: req.user._id,
    });
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    // Find the notification manually (avoid .id() quirks)
    const notif = listing.notifications.find(
      (n) => n._id.toString() === notifId
    );
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    notif.read = true;
    await listing.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── PATCH mark ALL notifications as read ─────────────────────────────────────
const markAllNotificationsRead = async (req, res) => {
  try {
    const listings = await Listing.find({ landlord: req.user._id });

    for (const listing of listings) {
      let changed = false;
      listing.notifications.forEach((n) => {
        if (!n.read) { n.read = true; changed = true; }
      });
      if (changed) await listing.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── PATCH save expo push token ────────────────────────────────────────────────
const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    await User.findByIdAndUpdate(req.user._id, { expoPushToken: token });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const editReview = async (req, res) => {
  try {
    const { rating, text } = req.body;
    const listing = await Listing.findById(req.params.id);

    if (!listing)
      return res.status(404).json({ message: "Listing not found" });

    const review = listing.reviews.id(req.params.reviewId);

    if (!review)
      return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "You can only edit your own reviews" });

    review.rating = rating ?? review.rating;
    review.text = text ?? review.text;
    await listing.save();

    res.json({ message: "Review updated", review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing)
      return res.status(404).json({ message: "Listing not found" });

    const review = listing.reviews.id(req.params.reviewId);

    if (!review)
      return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "You can only delete your own reviews" });

    review.deleteOne();
    await listing.save();

    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { Readable } = await import("stream");
    const { v2: cloudinary } = await import("cloudinary");

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "nyumba/avatars", resource_type: "image" },
        (err, result) => err ? reject(err) : resolve(result)
      );
      Readable.from(req.file.buffer).pipe(stream);
    });
      
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: result.secure_url },
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Avatar upload failed", error: err.message });
  }
};

const uploadMedia = async (req, res) => {
  try {
    const uploadedImages = (req.files?.images ?? []).map(
      (f) => `/uploads/${f.filename}`
    );
    const videoFile = req.files?.video?.[0];
    const uploadedVideo = videoFile ? `/uploads/${videoFile.filename}` : null;

    res.json({ uploadedImages, uploadedVideo });
  } catch (err) {
    res.status(500).json({ message: "Media upload failed", error: err.message });
  }
};

export {
  getListings,
  getListingById,
  createListing,
  updateListing,
  toggleVacancy,
  deleteListing,
  getMyListings,
  addReview,
  getReviews,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  savePushToken,
  editReview,
  deleteReview,
  uploadAvatar,
  uploadMedia,
};