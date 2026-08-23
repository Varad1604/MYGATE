import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { getAuth } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/jwt-auth.guard";
import { SseHubService } from "./sse-hub.service";

/**
 * Authenticated SSE stream (visitor approvals, tickets, notifications).
 * Authentication is enforced by the GLOBAL JwtAuthGuard registered in
 * AppModule (this route is not @Public), so no local guard is needed.
 */
@Controller("realtime")
export class RealtimeController {
  constructor(private readonly hub: SseHubService) {}

  @Get("stream")
  stream(@Res() res: Response): void {
    const req = res.req as unknown as AuthedRequest;
    const userId = getAuth(req).userId;
    const unsubscribe = this.hub.subscribe(userId, res);
    res.on("close", unsubscribe);
  }
}
