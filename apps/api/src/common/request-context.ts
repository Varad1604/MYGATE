import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  communityId?: string;
  /** Display snapshot for audit rows; filled by JwtAuthGuard after auth. */
  actorLabel?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function newRequestContext(ip?: string, ua?: string): RequestContext {
  return { requestId: randomUUID(), ip, userAgent: ua };
}
