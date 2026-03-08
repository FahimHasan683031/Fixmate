import { z } from "zod";

const createReview = z.object({
  body: z.object({
    feedback: z.string({ required_error: "Feedback is required" }),
    rating: z.number({ required_error: "Rating is required" }).min(1).max(5),
  })
});

export const ReviewValidations = {
  createReview
};
