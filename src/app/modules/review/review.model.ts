import { model, Schema } from "mongoose";
import { IReview } from "./review.interface";

const ReviewSchema = new Schema<IReview>({
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },
  review: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

ReviewSchema.index({ provider: 1 });
ReviewSchema.index({ service: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ createdAt: -1 });

export const Review = model<IReview>("Review", ReviewSchema);
