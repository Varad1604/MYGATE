import { z } from "zod";

export const CreateCommunitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(12).optional(),
  timezone: z.string().trim().max(60).default("Asia/Kolkata"),
});
export type CreateCommunityDto = z.infer<typeof CreateCommunitySchema>;

export const UpdateCommunitySettingsSchema = z.object({
  visitorApprovalTimeoutSeconds: z.number().int().min(15).max(3600).optional(),
  entryStartMinutes: z.number().int().min(0).max(1439).optional(),
  entryEndMinutes: z.number().int().min(0).max(1439).optional(),
  billingCycleDay: z.number().int().min(1).max(28).optional(),
  lateFeePerDayPaise: z.number().int().min(0).optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
});
export type UpdateCommunitySettingsDto = z.infer<typeof UpdateCommunitySettingsSchema>;

export const CreateTowerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9-]+$/, "Code must be alphanumeric."),
});
export type CreateTowerDto = z.infer<typeof CreateTowerSchema>;

export const CreateFloorSchema = z.object({
  level: z.number().int().min(-3).max(200),
  label: z.string().trim().max(20).optional(),
});

export const CreateUnitTypeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  bedrooms: z.number().int().min(0).max(20).optional(),
  areaSqft: z.number().positive().max(100000).optional(),
});

export const CreateUnitsSchema = z
  .object({
    towerId: z.string().uuid(),
    floorLevel: z.number().int().min(-3).max(200),
    labels: z.array(z.string().trim().min(1).max(20)).min(1).max(100),
    unitTypeId: z.string().uuid().optional(),
    areaSqft: z.number().positive().max(100000).optional(),
  })
  .refine((v) => new Set(v.labels).size === v.labels.length, { message: "Duplicate labels in request." });

export const UpdateUnitSchema = z.object({
  status: z.enum(["VACANT", "OWNER_OCCUPIED", "TENANT_OCCUPIED", "UNDER_MAINTENANCE", "INACTIVE"]).optional(),
  unitTypeId: z.string().uuid().nullable().optional(),
  areaSqft: z.number().positive().max(100000).nullable().optional(),
});

export const CreateGateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9-]+$/),
});

export const ListUnitsQuerySchema = z.object({
  towerId: z.string().uuid().optional(),
  status: z.enum(["VACANT", "OWNER_OCCUPIED", "TENANT_OCCUPIED", "UNDER_MAINTENANCE", "INACTIVE"]).optional(),
  q: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
