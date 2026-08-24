import { z } from "zod";

export const CreateTicketSchema = z.object({
  categoryId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  locationText: z.string().trim().max(120).optional(),
  title: z.string().trim().min(4).max(120),
  // UI presents details as optional; keep the contract honest.
  description: z.string().trim().max(3000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  clientEventId: z.string().uuid().optional(),
});

export const CommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  isInternal: z.boolean().default(false),
});

export const AssignSchema = z.object({
  assigneeUserId: z.string().uuid(),
});

export const StatusChangeSchema = z.object({
  status: z.enum([
    "OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD",
    "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
  ]),
  note: z.string().trim().max(500).optional(),
});

export const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const ListTicketsQuerySchema = z.object({
  status: z.string().trim().max(12).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  categoryId: z.string().uuid().optional(),
  mine: z.enum(["true", "false"]).optional(),
  raisedByMe: z.enum(["true", "false"]).optional(),
  breachedOnly: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
