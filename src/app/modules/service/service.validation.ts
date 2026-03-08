import { z } from "zod";

const createServiceSchema = z.object({
    body: z.object({
        category: z.string({ required_error: "Category is required" }),
        subCategory: z.string({ required_error: "Sub-category is required" }),
        price: z.number({ required_error: "Price is required" }),
        expertise: z.string({ required_error: "Expertise is required" }),
    }),
});

const updateServiceSchema = z.object({
    body: z.object({
        category: z.string().optional(),
        subCategory: z.string().optional(),
        price: z.number().optional(),
        expertise: z.string().optional(),
    }),
});

export const ServiceValidation = {
    createServiceSchema,
    updateServiceSchema,
};
