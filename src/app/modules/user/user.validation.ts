import { z } from "zod";
import { USER_ROLES, USER_STATUS } from "./user.interface";

export const userSignupSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    name: z.string().min(1, "Name is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum([USER_ROLES.CLIENT, USER_ROLES.PROVIDER]),
  })
});


export const userLoginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    password: z.string().min(1, "Password is required"),
  })
});

export const userUpdateSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").trim().toLowerCase().optional(),
    name: z.string().min(1, "Name is required").optional(),

    image: z.string().url("Invalid image URL").optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    status: z.nativeEnum(USER_STATUS).optional(),
    verified: z.boolean().optional(),
    role: z.nativeEnum(USER_ROLES).optional(),
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
  })
});

export const UserValidations = {
  userSignupSchema,
  userLoginSchema,
  userUpdateSchema,
  changePasswordSchema,
};
