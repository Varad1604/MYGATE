import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AccessContext } from "./auth.service";
import type { AuthedRequest } from "./jwt-auth.guard";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessContext => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) throw new Error("CurrentUser used on unauthenticated route");
    return req.auth;
  },
);
