import { z } from "zod";

const PLATE = z.string().trim().min(4).max(15)
  .regex(/^[A-Za-z0-9\- ]+$/, "Plate may contain letters, digits, spaces, dashes.")
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""));

export const RegisterVehicleSchema = z.object({
  number: PLATE,
  type: z.enum(["TWO_WHEELER", "FOUR_WHEELER", "COMMERCIAL"]).default("FOUR_WHEELER"),
  make: z.string().trim().max(40).optional(),
  model: z.string().trim().max(40).optional(),
  color: z.string().trim().max(30).optional(),
});

export const CreateParkingAreaSchema = z.object({
  name: z.string().trim().min(2).max(60),
  note: z.string().trim().max(200).optional(),
});

export const CreateSlotsSchema = z.object({
  slots: z.array(z.object({
    code: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9-]+$/),
    kind: z.enum(["RESIDENT", "VISITOR", "ACCESSIBLE", "TWO_WHEELER", "STAFF"]).default("RESIDENT"),
  })).min(1).max(200),
});

export const AllocateSlotSchema = z.object({
  vehicleId: z.string().uuid(),
  note: z.string().trim().max(200).optional(),
});
