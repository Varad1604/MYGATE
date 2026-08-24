import { z } from "zod";

export const CreateChargeHeadSchema = z.object({
  name: z.string().trim().min(2).max(60),
  calcMethod: z.enum(["FIXED", "AREA_BASED", "UNIT_TYPE_BASED", "METERED", "MANUAL"]).default("FIXED"),
  defaultAmountPaise: z.number().int().min(0),
  taxable: z.boolean().default(false),
  taxRateBps: z.number().int().min(0).max(5000).default(0),
});

export const CreateBillRunSchema = z.object({
  name: z.string().trim().min(2).max(60),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ONE_TIME"]),
  periodLabel: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM."),
  dueDate: z.coerce.date(),
  scope: z
    .object({
      kind: z.enum(["ALL_UNITS", "TOWER", "SELECTED_UNITS"]),
      towerId: z.string().uuid().optional(),
      unitIds: z.array(z.string().uuid()).optional(),
    })
    .default({ kind: "ALL_UNITS" }),
  lines: z
    .array(
      z.object({
        chargeHeadId: z.string().uuid(),
        amountPaise: z.number().int().min(0), // override; AREA_BASED uses per-sqft paise
        description: z.string().trim().max(120).optional(),
      }),
    )
    .min(1, "At least one line item."),
});

export const InitiatePaymentSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1),
  method: z.enum(["UPI", "CARD", "NETBANKING", "WALLET"]).default("UPI"),
}).refine((v) => v.invoiceIds.length > 0, { message: "Select at least one invoice." });

export const MockWebhookSchema = z.object({
  eventId: z.string().trim().min(6).max(80),
  type: z.enum(["payment.captured", "payment.failed"]),
  providerOrderId: z.string().trim().min(3),
  providerPaymentId: z.string().trim().min(3),
  amountPaise: z.number().int().positive(),
  signature: z.string().trim().min(10),
});
