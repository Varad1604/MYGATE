import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { Payment } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";
import type { IStorage } from "../../storage/storage";
import { MockPaymentProvider } from "./mock-payment.provider";
import { BillingService } from "./billing.service";

/** Thin typed accessor over the global IStorage token. */
@Injectable()
export class StorageService {
  constructor(@Inject("IStorage") private readonly storage: IStorage) {}
  put(key: string, data: Buffer, contentType: string) {
    return this.storage.put(key, data, contentType);
  }
  signedUrl(key: string, ttl?: number) {
    return this.storage.signedUrl(key, ttl);
  }
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly provider: MockPaymentProvider,
    private readonly billing: BillingService,
    private readonly storage: StorageService,
  ) {}

  /** Resident/admin starts a payment for the given open invoices. */
  async initiate(communityId: string, payerUserId: string | null, dto: {
    invoiceIds: string[]; method: string;
  }, idempotencyKey?: string): Promise<Payment> {
    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: dto.invoiceIds }, communityId },
    });
    if (invoices.length !== dto.invoiceIds.length) throw Errors.notFound("Invoice");
    const unitIds = new Set(invoices.map((i) => i.unitId));
    if (unitIds.size !== 1) {
      throw new BadRequestException("All invoices in one payment must belong to the same unit.");
    }
    const open = invoices.filter((i) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status));
    if (!open.length) throw Errors.conflict("NO_OPEN_INVOICES", "Invoices are not payable.");
    const amount = open.reduce((s, i) => s + (i.totalPaise - i.paidPaise), 0);
    if (amount <= 0) throw Errors.conflict("NOTHING_DUE", "Selected invoices have nothing due.");

    const order = this.provider.createOrder(amount, "societyos");
    const unitId: string = [...unitIds][0]!;
    const payment = await this.prisma.payment.create({
      data: {
        communityId,
        unitId,
        payerUserId,
        provider: "MOCK",
        method: dto.method as never,
        amountPaise: amount,
        status: "PENDING",
        providerOrderId: order.providerOrderId,
        idempotencyKey: idempotencyKey ?? null,
      },
    });
    return payment;
  }

  /**
   * Webhook handler — IDEMPOTENT by webhookEventId. Signature verified with
   * HMAC before any state change; replaying the same eventId is a no-op.
   */
  async handleWebhook(payload: {
    eventId: string; type: "payment.captured" | "payment.failed";
    providerOrderId: string; providerPaymentId: string; amountPaise: number; signature: string;
  }): Promise<{ duplicate: boolean }> {
    if (!this.provider.verify(payload, payload.signature)) {
      throw new BadRequestException("Invalid webhook signature.");
    }
    // Idempotency: unique webhookEventId claim.
    try {
      await this.prisma.payment.updateMany({
        where: { providerOrderId: payload.providerOrderId },
        data: {}, // touch nothing yet — existence check first
      });
    } catch { /* ignore */ }

    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId: payload.providerOrderId },
    });
    if (!payment) throw Errors.notFound("Payment");

    const alreadyProcessed = await this.prisma.payment.findFirst({
      where: { id: payment.id, NOT: { webhookEventId: null } },
    });
    if (alreadyProcessed?.webhookEventId === payload.eventId) return { duplicate: true };
    if (alreadyProcessed) {
      // Different event on an already-finalized payment — ignore as dup.
      return { duplicate: true };
    }

    if (payload.type === "payment.failed") {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: `provider event ${payload.eventId}`,
          providerPaymentId: payload.providerPaymentId,
        },
      });
      return { duplicate: false };
    }

    if (payload.amountPaise !== payment.amountPaise) {
      throw new ConflictException("Webhook amount mismatch.");
    }

    await this.prisma.$transaction(async (tx) => {
      // Claim the event atomically.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, webhookEventId: null },
        data: { webhookEventId: payload.eventId },
      });
      if (claimed.count === 0) throw new ConflictException("Already processed.");

      const excess = await this.billing.allocatePayment(tx, {
        communityId: payment.communityId,
        unitId: payment.unitId,
        paymentId: payment.id,
        amountPaise: payload.amountPaise,
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          providerPaymentId: payload.providerPaymentId,
          verifiedAt: new Date(),
          completedAt: new Date(),
        },
      });
      await tx.receipt.create({
        data: {
          communityId: payment.communityId,
          reference: `RCPT-${payload.providerPaymentId.slice(-8).toUpperCase()}`,
          paymentId: payment.id,
        },
      });
      void excess;
    });

    const final = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    await this.audit.record({
      action: "billing.payment_captured", entityType: "payment", entityId: final.id,
      communityId: final.communityId,
      after: { amountPaise: final.amountPaise, providerPaymentId: payload.providerPaymentId },
    });
    await this.generateReceiptPdf(final.id);
    return { duplicate: false };
  }

  /** Renders the receipt PDF into storage and links it. */
  async generateReceiptPdf(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        receipt: true,
        allocations: { include: { invoice: { select: { reference: true, periodLabel: true } } } },
      },
    });
    if (!payment?.receipt || payment.receipt.pdfFileId) return;

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    doc.fontSize(18).text("Maintenance Payment Receipt", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Receipt: ${payment.receipt.reference}`);
    doc.text(`Payment ID: ${payment.id}`);
    doc.text(`Date: ${new Date().toISOString()}`);
    doc.moveDown();
    doc.fontSize(12).text(`Amount paid: INR ${(payment.amountPaise / 100).toFixed(2)}`);
    doc.text(`Method: ${payment.method ?? "—"}`);
    doc.moveDown();
    doc.fontSize(11).text("Invoices settled:");
    for (const alloc of payment.allocations) {
      doc.fontSize(10).text(
        `• ${alloc.invoice.reference} (${alloc.invoice.periodLabel}) — INR ${(alloc.amountPaise / 100).toFixed(2)}`,
      );
    }
    doc.end();
    const pdf = await done;

    const key = `receipts/${payment.receipt.reference}.pdf`;
    await this.storage.put(key, pdf, "application/pdf");
    const fileRef = await this.prisma.fileRef.create({
      data: {
        communityId: payment.communityId,
        storageKey: key,
        originalName: `${payment.receipt.reference}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        visibility: "COMMUNITY",
      },
    });
    await this.prisma.receipt.update({
      where: { id: payment.receipt.id },
      data: { pdfFileId: fileRef.id },
    });
  }

  async listForUnit(communityId: string, unitId: string) {
    return this.prisma.payment.findMany({
      where: { communityId, unitId },
      orderBy: { initiatedAt: "desc" },
      take: 50,
      include: { receipt: { select: { reference: true, pdfFileId: true } } },
    });
  }
}
