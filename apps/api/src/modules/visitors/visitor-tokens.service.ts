import { createHash, randomBytes, randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { VISITOR_TRANSITIONS, type VisitorStatus } from "@societyos/types";
import { PrismaService } from "../../prisma/prisma.service";

/** Domain-level visitor state transition guard (ADR-006). */
export function assertTransition(from: VisitorStatus, to: VisitorStatus): void {
  const allowed = VISITOR_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Cannot transition visitor from ${from} to ${to}`), {
      code: "INVALID_STATE_TRANSITION",
    });
  }
}

export interface ResolvedVisitor {
  invitationId: string;
  communityId: string;
  unitId: string;
}

/**
 * Token/OTP resolution + lifecycle helpers shared by resident and guard flows.
 * Tokens are opaque; only hashes are stored (spec §8).
 */
@Injectable()
export class VisitorTokensService {
  constructor(private readonly prisma: PrismaService) {}

  newInvitationToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, tokenHash: this.hashToken(token) };
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  newOtp(): { otp: string; otpHash: string } {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    return { otp, otpHash: createHash("sha256").update(otp).digest("hex") };
  }

  /** Resolves a check-in credential to an APPROVED invitation (single-use enforced at call site). */
  async resolveApprovedCredential(input: {
    communityId: string;
    invitationId?: string;
    token?: string;
    otp?: string;
  }) {
    if (input.token) {
      return this.prisma.visitorInvitation.findFirst({
        where: { communityId: input.communityId, tokenHash: this.hashToken(input.token) },
      });
    }
    if (input.otp) {
      const hash = createHash("sha256").update(input.otp).digest("hex");
      return this.prisma.visitorInvitation.findFirst({
        where: {
          communityId: input.communityId,
          otpCodeHash: hash,
          expiresAt: { gt: new Date() },
        },
      });
    }
    if (input.invitationId) {
      return this.prisma.visitorInvitation.findFirst({
        where: { id: input.invitationId, communityId: input.communityId },
      });
    }
    return null;
  }
}
