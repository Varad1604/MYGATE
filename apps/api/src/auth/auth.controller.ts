import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService, normalizeTarget } from "./auth.service";
import {
  LoginSchema,
  RefreshSchema,
  RequestOtpSchema,
  SwitchCommunitySchema,
  VerifyOtpSchema,
} from "./auth.dto";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./jwt-auth.guard";
import { getAuth } from "./jwt-auth.guard";
import type { AccessContext } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private meta(req: Request) {
    return {
      ip: req.ip,
      ua: (req.headers["user-agent"] as string | undefined) ?? undefined,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Req() req: Request, @Body(new ZodValidationPipe(LoginSchema)) dto: unknown) {
    const { identifier, password } = dto as { identifier: string; password: string };
    return this.authService.loginWithPassword(identifier, password, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("request-otp")
  @HttpCode(200)
  async requestOtp(@Body(new ZodValidationPipe(RequestOtpSchema)) dto: unknown) {
    const { target } = dto as { target: string };
    return this.authService.requestOtp(normalizeTarget(target), "LOGIN");
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-otp")
  @HttpCode(200)
  async verifyOtp(@Req() req: Request, @Body(new ZodValidationPipe(VerifyOtpSchema)) dto: unknown) {
    const { target, code, fullName } = dto as { target: string; code: string; fullName?: string };
    return this.authService.verifyOtp(target, code, { ...this.meta(req), fullName });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Body(new ZodValidationPipe(RefreshSchema)) dto: unknown) {
    const { refreshToken } = dto as { refreshToken: string };
    return this.authService.refresh(refreshToken, this.meta(req));
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Body(new ZodValidationPipe(RefreshSchema)) dto: unknown) {
    const { refreshToken } = dto as { refreshToken: string };
    return this.authService.logout(refreshToken);
  }

  @Post("switch-community")
  @HttpCode(200)
  async switchCommunity(
    @CurrentUser() auth: AccessContext,
    @Body(new ZodValidationPipe(SwitchCommunitySchema)) dto: unknown,
  ) {
    return this.authService.switchCommunity(auth.userId, (dto as { communityId: string }).communityId);
  }

  @Get("me")
  me(@CurrentUser() auth: AccessContext) {
    void getAuth;
    return auth;
  }
}
