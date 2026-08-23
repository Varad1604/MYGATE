import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { getEnv } from "../config/env";
import { getRequestContext } from "../common/request-context";
import type { AccessContext } from "./auth.service";
import { AuthService } from "./auth.service";

export interface AuthedRequest extends Request {
  auth?: AccessContext;
  rawAccessToken?: string;
}

export const IS_PUBLIC_KEY = "isPublic";
/** Marks a route as unauthenticated. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (isPublic) return true;

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException();
    const token = header.slice(7);
    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: getEnv().JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== "access") throw new UnauthorizedException();

    req.auth = await this.authService.loadAccessContext(payload.sub);
    req.rawAccessToken = token;
    const rctx = getRequestContext();
    if (rctx) {
      rctx.userId = payload.sub;
      rctx.communityId = req.auth.communityId;
    }
    return true;
  }
}

export function getAuth(req: Request): AccessContext {
  const auth = (req as AuthedRequest).auth;
  if (!auth) throw new UnauthorizedException();
  return auth;
}

export type { Response };
