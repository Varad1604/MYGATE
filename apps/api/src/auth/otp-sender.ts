/** Abstraction over SMS/email delivery for one-time codes (ADR-002). */
export interface OtpSendRequest {
  target: string; // normalized phone or email
  code: string;
  purpose: "LOGIN" | "PASSWORD_RESET" | "EMAIL_VERIFY";
}

export interface IOtpSender {
  send(req: OtpSendRequest): Promise<void>;
}

const lastCodes = new Map<string, { code: string; at: number }>();

/**
 * Development-only sender: logs the OTP to the API console.
 * NEVER selected in production paths (env guard in OtpService).
 * Also remembers the last code per target so dev/E2E tooling can retrieve it
 * via the strictly development-gated /__dev endpoint.
 */
export class MockOtpSender implements IOtpSender {
  async send(req: OtpSendRequest): Promise<void> {
    lastCodes.set(req.target, { code: req.code, at: Date.now() });
    // eslint-disable-next-line no-console
    console.log(`[mock-otp] ${req.purpose} code for ${req.target}: ${req.code}`);
  }

  /** Dev/E2E only. Returns codes younger than 10 minutes. */
  peekLastCode(target: string): string | null {
    const rec = lastCodes.get(target);
    if (!rec || Date.now() - rec.at > 600_000) return null;
    return rec.code;
  }
}
