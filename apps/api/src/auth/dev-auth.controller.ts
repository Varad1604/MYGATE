import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "./jwt-auth.guard";
import { AuthService } from "./auth.service";
import { getEnv } from "../config/env";
import { Errors } from "../common/app-exception";

/**
 * STRICTLY development/E2E support — disabled unless NODE_ENV=development.
 * Never exists as a usable surface in production (404-style rejection).
 */
@Controller("__dev")
export class DevAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get("last-otp")
  lastOtp(@Query("target") target: string): { code: string | null } {
    if (getEnv().NODE_ENV !== "development") {
      throw Errors.notFound();
    }
    return { code: this.authService.peekLastOtp(target) };
  }
}
