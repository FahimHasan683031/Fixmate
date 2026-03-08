import { z } from "zod";

const termsAndPolicySchema = z.object({
    body: z.object({
        content: z.string({ required_error: "Content is required" }),
    }),
});

export const TermsAndPolicyValidation = {
    termsAndPolicySchema,
};
