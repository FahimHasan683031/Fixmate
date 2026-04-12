import { z } from 'zod';

const createServiceZodSchema = z.object({
  body: z.object({
    category: z.string({ required_error: 'Category is required' }),
    subCategory: z.string({ required_error: 'Sub-category is required' }),
    price: z.coerce.number({ required_error: 'Price is required' }).min(0, 'Price must be a positive number'),
    expertise: z.string().optional(),
    image: z.string().optional(),
  }),
});

const updateServiceZodSchema = z.object({
  body: z.object({
    category: z.string().optional(),
    subCategory: z.string().optional(),
    price: z.coerce.number().optional(),
    expertise: z.string().optional(),
    image: z.string().optional(),
  }),
});

const toggleSuspensionZodSchema = z.object({
  body: z.object({
    isSuspended: z.boolean({ required_error: 'isSuspended (boolean) is required' }),
  }),
});

export const ServiceValidation = {
  createServiceZodSchema,
  updateServiceZodSchema,
  toggleSuspensionZodSchema,
};
