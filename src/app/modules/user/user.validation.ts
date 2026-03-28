import { z } from 'zod';

const updateProfileZodSchema = z.object({
  body: z
    .object({
      name: z.string().optional(),
      gender: z.string().optional(),
      address: z.string().optional(),
      dateOfBirth: z.string().optional(),
      nationality: z.string().optional(),
      whatsApp: z.string().optional(),
      contact: z.string().optional(),
      overView: z.string().optional(),
      experience: z.string().optional(),
      language: z.string().optional(),
      category: z.string().optional(),
      longitude: z.coerce.number().optional(),
      latitude: z.coerce.number().optional(),
      image: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
    })
    .strict(),
});

export const UserValidation = {
  updateProfileZodSchema,
};
