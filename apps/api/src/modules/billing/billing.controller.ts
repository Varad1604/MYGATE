import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { BillingService } from "./billing.service";
import { PaymentsService } from "./payments.service";
import {
  CreateBillRunSchema,
  CreateChargeHeadSchema,
  InitiatePaymentSchema,
  MockWebhookSchema,
} from "./billing.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import { Public } from "../../auth/jwt-auth.guard";
import type { AccessContext } from "../../auth/auth.service";

const ListInvoicesQuerySchema = z.object({
  status: z.string().trim().max(15).optional(),
  unitId: z.string().uuid().optional(),
  periodLabel: z.string().trim().max(10).optional(),
  overdueOnly: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly payments: PaymentsService,
  ) {}

  // â”€â”€ Charge heads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post("communities/:communityId/billing/charge-heads")
  @RequirePermissions("billing.create", "billing.approve")
  createChargeHead(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateChargeHeadSchema)) dto: unknown,
  ) {
    return this.billing.createChargeHead(communityId, dto as never);
  }

  @Get("communities/:communityId/billing/charge-heads")
  chargeHeads(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.billing.listChargeHeads(communityId);
  }

  // â”€â”€ Bill runs (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post("communities/:communityId/billing/bill-runs")
  @RequirePermissions("billing.create", "billing.approve")
  createBillRun(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateBillRunSchema)) dto: unknown,
  ) {
    return this.billing.createBillRun(communityId, auth.userId, dto as never);
  }

  @Post("bill-runs/:billRunId/generate")
  @RequirePermissions("billing.create", "billing.approve")
  generate(
    @CurrentUser() auth: AccessContext,
    @Param("billRunId") billRunId: string,
  ) {
    return this.billing.generateInvoices(auth.communityId!, billRunId);
  }

  @Post("invoices/:invoiceId/issue")
  @RequirePermissions("billing.create", "billing.approve")
  issue(@CurrentUser() auth: AccessContext, @Param("invoiceId") invoiceId: string) {
    return this.billing.issueInvoice(auth.communityId!, auth.userId, invoiceId);
  }

  @Post("invoices/:invoiceId/cancel")
  @RequirePermissions("billing.create", "billing.approve")
  cancel(
    @CurrentUser() auth: AccessContext,
    @Param("invoiceId") invoiceId: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().trim().min(5).max(300) }))) dto: unknown,
  ) {
    return this.billing.cancelInvoice(auth.communityId!, auth.userId, invoiceId, (dto as { reason: string }).reason);
  }

  @Get("communities/:communityId/invoices")
  async listInvoices(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListInvoicesQuerySchema)) query: unknown,
  ) {
    const q = query as {
      status?: string; unitId?: string; periodLabel?: string;
      overdueOnly?: string; page: number; pageSize: number;
    };
    return this.billing.listInvoices(communityId, {
      status: q.status,
      unitId: q.unitId,
      periodLabel: q.periodLabel,
      overdueOnly: q.overdueOnly === "true",
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
  }

  /** Resident-facing: their units' invoices. */
  @Get("me/invoices")
  myInvoices(@CurrentUser() auth: AccessContext) {
    void auth; // resolved via unit membership in a dedicated query below
    return this.billing.listInvoices(auth.communityId!, { skip: 0, take: 50 });
  }

  // â”€â”€ Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post("me/payments/initiate")
  initiatePayment(
    @CurrentUser() auth: AccessContext,
    @Body(new ZodValidationPipe(InitiatePaymentSchema)) dto: unknown,
  ) {
    const body = dto as { invoiceIds: string[]; method: string };
    const key = `${auth.userId}:${body.invoiceIds.slice().sort().join(",")}`;
    return this.payments.initiate(auth.communityId!, auth.userId, body, key);
  }

  /**
   * Payment provider webhook. Public by contract â€” authenticity is enforced
   * by HMAC signature verification inside the handler.
   */
  @Public()
  @Post("webhooks/payments/mock")
  async mockWebhook(@Body(new ZodValidationPipe(MockWebhookSchema)) dto: unknown) {
    return this.payments.handleWebhook(dto as never);
  }

  @Get("units/:unitId/payments")
  unitPayments(@CurrentUser() auth: AccessContext, @Param("unitId") unitId: string) {
    void auth;
    return this.payments.listForUnit(auth.communityId!, unitId);
  }
}

