import { z } from "zod";

const sendVerificationRequestSchema = z.object({
    body: z.object({
        nid: z.string({ required_error: "NID number is required" }),
    }),
});

export const VerificationValidation = {
    sendVerificationRequestSchema,
};
