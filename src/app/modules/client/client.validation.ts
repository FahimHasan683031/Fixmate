import { z } from 'zod';

const updateUserZodSchema = z.object({
    body: z.object({
        name: z.string().optional(),
        contact: z.string().optional(),
        whatsApp: z.string().optional(),
        dateOfBirth: z.string().optional(),
        gender: z.string().optional(),
        address: z.string().optional(),
        longitude: z.string().optional(),
        latitude: z.string().optional(),
        image: z.string().optional(),
    }),
});

const getPaginationZodSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.string().optional(),
        search: z.string().optional(),
        category: z.string().optional(),
        subCategory: z.string().optional(),
        price: z.string().optional(),
        distance: z.string().optional(),
        rating: z.string().optional(),
    }),
});

export const ClientValidation = {
    updateUserZodSchema,
    getPaginationZodSchema,
};
