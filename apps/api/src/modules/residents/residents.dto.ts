import { z } from "zod";

export const AddResidentSchema = z.object({
  unitId: z.string().uuid(),
  kind: z.enum(["OWNER", "TENANT", "FAMILY"]),
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?\d[\d\s-]{7,17})?$/, "Invalid phone.")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  isPrimaryContact: z.boolean().default(false),
  effectiveFrom: z.coerce.date().optional(),
}).refine((v) => Boolean(v.phone || v.email), { message: "Phone or email is required." });

export const ListResidentsQuerySchema = z.object({
  unitId: z.string().uuid().optional(),
  kind: z.enum(["OWNER", "TENANT", "FAMILY"]).optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const UpdateResidentSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().optional(),
});

export const CreateEmergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\+?\d[\d\s-]{7,17}$/, "Invalid phone."),
  relation: z.string().trim().max(40).optional(),
});
