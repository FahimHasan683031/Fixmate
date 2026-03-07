import mongoose from "mongoose"
import { IReview } from "./review.interface"

const ReviewSchema = new mongoose.Schema<IReview>({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
  },
  comment: {
    type: String
  },
}, {
  timestamps: true,
})

export const Review = mongoose.model<IReview>('Review', ReviewSchema)
