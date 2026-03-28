import { z } from 'zod';

const createReviewSchema = z.object({
  body: z.object({
    review: z.string({
      required_error: 'Review is required',
    }),
    rating: z.number({
      required_error: 'Rating is required',
    }).min(1).max(5),
    bookingId: z.string({
      required_error: 'Service (booking) ID is required',
    }),
  }),
});

export const ReviewValidation = {
  createReviewSchema,
};
