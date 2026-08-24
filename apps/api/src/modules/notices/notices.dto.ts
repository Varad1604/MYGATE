import { z } from "zod";

export const CreateNoticeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(5000),
  type: z.enum(["ANNOUNCEMENT", "EMERGENCY", "MAINTENANCE", "EVENT", "BILLING_REMINDER", "SECURITY"]),
  audience: z.enum(["ALL", "TOWER", "FLOOR", "UNIT", "OWNERS", "TENANTS", "CUSTOM_GROUP"]),
  audienceTarget: z
    .object({
      towerId: z.string().uuid().optional(),
      floor: z.number().int().min(0).max(200).optional(),
      unitIds: z.array(z.string().uuid()).optional(),
      userIds: z.array(z.string().uuid()).optional(),
    })
    .default({}),
  requireAcknowledgement: z.boolean().default(false),
  publishAt: z.coerce.date().default(() => new Date()),
  expiresAt: z.coerce.date().optional(),
});

export const UpdateNoticeSchema = CreateNoticeSchema.partial();

export const NoticeAckSchema = z.object({});
