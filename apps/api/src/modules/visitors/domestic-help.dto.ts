import { z } from "zod";

export const CATEGORIES = [
  "MAID", "COOK", "DRIVER", "NANNY", "CLEANER",
  "ELECTRICIAN", "PLUMBER", "GARDENER", "TRAINER", "OTHER",
] as const;

export const CreateHelpProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,17})$/).optional(),
  category: z.enum(CATEGORIES),
  scheduleText: z.string().trim().max(120).optional(),
  unitIds: z.array(z.string().uuid()).min(1, "Assign at least one unit."),
});

export const AssignUnitSchema = z.object({
  unitId: z.string().uuid(),
  allowedDays: z.string().regex(/^([1-7])(,[1-7])*$/).default("1,2,3,4,5,6"),
});
