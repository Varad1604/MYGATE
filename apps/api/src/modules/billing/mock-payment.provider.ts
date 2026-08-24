import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { getEnv } from "../../config/env";

export interface PaymentOrder {
  providerOrderId: string;
  amountPaise: number;
}

/**
 * Development/staging payment provider (ADR-004). Deterministic HMAC-signed
 * webhook payloads so the verification path is exercised for real; production
 * swaps this adapter for Razorpay/Stripe behind the same interface.
 */
@Injectable()
export class MockPaymentProvider {
  createOrder(amountPaise: number, reference: string): PaymentOrder {
    const providerOrderId = `mockorder_${randomBytes(8).toString("hex")}`;
    void reference;
    return { providerOrderId, amountPaise };
  }

  secret(): string {
    return getEnv().MOCK_PAYMENT_WEBHOOK_SECRET;
  }

  /** Canonical signature over the deterministic payload serialization. */
  sign(payload: {
    eventId: string;
    type: string;
    providerOrderId: string;
    providerPaymentId: string;
    amountPaise: number;
  }): string {
    return createHmac("sha256", this.secret())
      .update(`${payload.eventId}|${payload.type}|${payload.providerOrderId}|${payload.providerPaymentId}|${payload.amountPaise}`)
      .digest("hex");
  }

  verify(payload: Parameters<MockPaymentProvider["sign"]>[0], signature: string): boolean {
    const expected = Buffer.from(this.sign(payload), "utf8");
    const given = Buffer.from(signature, "utf8");
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
