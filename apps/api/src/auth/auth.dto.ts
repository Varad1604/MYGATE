import { z } from "zod";

const phoneOrEmail = z
  .string()
  .trim()
  .min(5)
  .max(120)
  .refine((v) => /^(\+?\d[\d\s-]{7,17}|[^@\s]+@[^@\s]+\.[^@\s]+)$/.test(v), {
    message: "Must be a valid phone number or email address.",
  });

export const LoginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(8).max(128),
});

export const RequestOtpSchema = z.object({
  target: phoneOrEmail,
});

export const VerifyOtpSchema = z.object({
  target: phoneOrEmail,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits."),
  fullName: z.string().trim().min(1).max(80).optional(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const SwitchCommunitySchema = z.object({
  communityId: z.string().uuid(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type RefreshDto = z.infer<typeof RefreshSchema>;
