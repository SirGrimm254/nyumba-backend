import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    priceUnit: { type: String, enum: ["month", "week", "day"], default: "month" },
    location: { type: String, required: true },
    city: { type: String, required: true },
    bedrooms: { type: Number, default: 1 },
    bathrooms: { type: Number, default: 1 },
    size: { type: Number, default: 0 },
    propertyType: { type: String, required: true },
    amenities: { type: Map, of: Boolean, default: {} },
    isVacant: { type: Boolean, default: true },
    availableFrom: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    images: [{ type: String }],
    video: { type: String, default: null },
    landlord: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // analytics — unique viewers tracked by user ID
    views: { type: Number, default: 0 },
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    enquiries: { type: Number, default: 0 },

    // reviews
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        text: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    averageRating: { type: Number, default: 0 },

    // notifications stored on the listing for inbox
    notifications: [
      {
        type: { type: String, enum: ["review", "view", "enquiry"], default: "review" },
        fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        fromName: { type: String },
        message: { type: String },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);
export default Listing;