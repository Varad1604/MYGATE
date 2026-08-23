/** Abstraction over SMS/email delivery for one-time codes (ADR-002). */
export interface OtpSendRequest {
  target: string; // normalized phone or email
  code: string;
  purpose: "LOGIN" | "PASSWORD_RESET" | "EMAIL_VERIFY";
}

export interface IOtpSender {
  send(req: OtpSendRequest): Promise<void>;
}

/**
 * Development-only sender: logs the OTP to the API console.
 * NEVER selected in production paths (env guard in OtpService).
 */
export class MockOtpSender implements IOtpSender {
  async send(req: OtpSendRequest): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[mock-otp] ${req.purpose} code for ${req.target}: ${req.code}`);
  }
}
