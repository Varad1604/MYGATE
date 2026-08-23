import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission } from "@societyos/permissions";
import { Errors } from "../common/app-exception";
import type { AuthedRequest } from "./jwt-auth.guard";

export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * Declares the permissions a route requires (ALL of them).
 * Enforcement happens here — server-side — on every request.
 */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) throw Errors.unauthorized();
    // Platform super admin bypasses community-scoped permission checks.
    if (req.auth.isPlatformSuperAdmin) return true;
    if (!hasPermission(req.auth.permissions, required)) {
      throw Errors.forbidden(
        `Missing required permission(s): ${required.join(", ")}`,
        "PERMISSION_DENIED",
      );
    }
    return true;
  }
}
