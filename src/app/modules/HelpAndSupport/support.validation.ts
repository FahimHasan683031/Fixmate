import { z } from 'zod';

const supportSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .min(3, 'Title must be at least 3 characters long')
        .max(100, 'Title must be at most 100 characters long'),
      description: z
        .string()
        .min(3, 'Description must be at least 3 characters long')
        .max(1000, 'Description must be at most 1000 characters long'),
      image: z.string().optional(),
    })
    .strict(),
});

const getSupportSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().optional().default(1),
      limit: z.coerce.number().optional().default(10),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      sortBy: z.string().optional().default('createdAt'),
      status: z.string().optional(),
      search: z.string().optional(),
    })
    .strict(),
});

export const supportValidation = {
  supportSchema,
  getSupportSchema,
};
