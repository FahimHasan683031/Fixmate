import { z } from "zod";

export const ReviewValidationSchema = z.object({
  body:z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
    comment: z.string().optional(),
  })
})
