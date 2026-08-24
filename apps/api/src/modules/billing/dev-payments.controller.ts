import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { Public } from "../../auth/jwt-auth.guard";
import { getEnv } from "../../config/env";
import { Errors } from "../../common/app-exception";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PaymentsService } from "./payments.service";

const CaptureBody = z.object({
  providerOrderId: z.string().trim().min(3).max(80),
});

/**
 * DEV-ONLY payment simulation: signs a capture event with the dev secret and
 * pushes it through the SAME verified webhook path the real gateway uses.
 * Registered only in development builds.
 */
@Controller("__dev")
export class DevPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post("payments/capture")
  async capture(
    @Body(new ZodValidationPipe(CaptureBody)) dto: unknown,
  ): Promise<{ duplicate: boolean }> {
    if (getEnv().NODE_ENV !== "development") throw Errors.notFound();
    return this.payments.devCapture((dto as { providerOrderId: string }).providerOrderId);
  }
}
