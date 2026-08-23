/**
 * Domain exception carrying a stable machine-readable code.
 * The exception filter converts everything (domain, zod, Prisma, unknown)
 * into the standardized error envelope — raw DB errors never reach clients.
 */
export class AppException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppException";
  }
}

export const Errors = {
  unauthorized: (msg = "Authentication required.") => new AppException("UNAUTHORIZED", msg, 401),
  forbidden: (msg = "You do not have access to this resource.", code = "FORBIDDEN") =>
    new AppException(code, msg, 403),
  notFound: (entity = "Resource") => new AppException("NOT_FOUND", `${entity} not found.`, 404),
  conflict: (code: string, msg: string) => new AppException(code, msg, 409),
  validation: (msg: string, details?: unknown) => new AppException("VALIDATION_FAILED", msg, 422, details),
  rateLimited: (msg = "Too many requests. Try again later.") =>
    new AppException("RATE_LIMITED", msg, 429),
  invalidTransition: (from: string, to: string) =>
    new AppException("INVALID_STATE_TRANSITION", `Cannot transition from ${from} to ${to}.`, 409),
  crossTenant: () =>
    new AppException("CROSS_TENANT_ACCESS_DENIED", "This record belongs to another community.", 403),
};
