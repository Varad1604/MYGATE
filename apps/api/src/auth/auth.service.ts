import { createHash, randomBytes, randomInt } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash as argonHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { PrismaService } from "../prisma/prisma.service";
import { getEnv } from "../config/env";
import { Errors } from "../common/app-exception";
import type { IOtpSender } from "./otp-sender";
import { MockOtpSender } from "./otp-sender";

export interface AccessContext {
  userId: string;
  communityId?: string;
  isPlatformSuperAdmin: boolean;
  roleKeys: string[];
  permissions: string[];
  memberships: { communityId: string; communityName: string; roleKeys: string[]; isDefault: boolean }[];
}

/** Shape returned to clients (identical today; isolates future internal fields). */
export function publicContext(ctx: AccessContext): AccessContext {
  return ctx;
}

const ACCESS = "access";
const REFRESH = "refresh";

@Injectable()
export class AuthService {
  private readonly otpSender: IOtpSender;
  /** Small TTL cache so per-request permission loading stays cheap. */
  private readonly ctxCache = new Map<string, { at: number; ctx: AccessContext }>();
  private static readonly CTX_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    const env = getEnv();
    this.otpSender =
      env.NODE_ENV === "production"
        ? (() => {
            throw new Error("Production OTP provider adapter not configured yet — refusing mock.");
          })()
        : new MockOtpSender();
  }

  // ── Password login (admins) ────────────────────────────────────────────────

  async loginWithPassword(identifier: string, password: string, meta: { ip?: string; ua?: string }) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: normalizePhone(identifier) }],
        deletedAt: null,
      },
    });
    // Uniform error + dummy verify to avoid user-enumeration timing signals.
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$c29jaWV0eW9z$c2FsdGVkdmFsdWVoZXJl";
    if (!user || !user.passwordHash || user.status !== "ACTIVE") {
      await verify(dummyHash, password).catch(() => undefined);
      throw Errors.unauthorized("Invalid credentials.");
    }
    const ok = await verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw Errors.unauthorized("Invalid credentials.");
    return this.issueSession(user.id, meta);
  }

  // ── OTP login ──────────────────────────────────────────────────────────────

  async requestOtp(rawTarget: string, purpose: "LOGIN" | "PASSWORD_RESET" | "EMAIL_VERIFY") {
    const target = normalizeTarget(rawTarget);
    this.assertNotSpammy(target);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const env = getEnv();
    await this.prisma.otpCode.create({
      data: {
        target,
        purpose,
        codeHash: await sha256(code),
        expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
      },
    });
    await this.otpSender.send({ target, code, purpose });
    return { sentTo: maskTarget(target), expiresInSec: env.OTP_TTL_SECONDS };
  }

  async verifyOtp(rawTarget: string, code: string, meta: { ip?: string; ua?: string; fullName?: string }) {
    const target = normalizeTarget(rawTarget);
    this.assertNotSpammy(target);
    const rec = await this.prisma.otpCode.findFirst({
      where: { target, consumedAt: null, expiresAt: { gt: new Date() }, purpose: "LOGIN" },
      orderBy: { createdAt: "desc" },
    });
    const env = getEnv();
    if (!rec) throw Errors.unauthorized("No active code. Request a new one.");
    if (rec.attempts >= env.OTP_MAX_ATTEMPTS) throw Errors.rateLimited("Too many incorrect attempts.");

    const matches = (await sha256(code)) === rec.codeHash;
    if (!matches) {
      await this.prisma.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
      throw Errors.unauthorized("Incorrect code.");
    }
    await this.prisma.otpCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });

    let user = await this.prisma.user.findFirst({
      where: isEmail(target)
        ? { email: target.toLowerCase(), deletedAt: null }
        : { phone: target, deletedAt: null },
    });
    if (!user) {
      // Phone-first self-onboarding: bare account until linked to a unit by an admin.
      user = await this.prisma.user.create({
        data: {
          fullName: meta.fullName?.trim() || "New Resident",
          phone: isEmail(target) ? null : target,
          email: isEmail(target) ? target.toLowerCase() : null,
          status: "PENDING_ONBOARDING",
        },
      });
    }
    if (user.status === "DEACTIVATED") throw Errors.forbidden("This account has been deactivated.", "ACCOUNT_DEACTIVATED");
    return this.issueSession(user.id, meta);
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async issueSession(userId: string, meta: { ip?: string; ua?: string }) {
    const familyId = randomBytes(16).toString("hex");
    return this.rotateWithinFamily(userId, familyId, meta);
  }

  async refresh(refreshTokenRaw: string, meta: { ip?: string; ua?: string }) {
    let payload: { sub: string; fam: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(refreshTokenRaw, { secret: getEnv().JWT_REFRESH_SECRET });
    } catch {
      throw Errors.unauthorized("Invalid session.");
    }
    if (payload.typ !== REFRESH) throw Errors.unauthorized("Invalid session token.");

    const tokenHash = await sha256(refreshTokenRaw);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Possible reuse of a rotated token → revoke whole family.
      if (stored?.revokedAt && stored.familyId) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw Errors.unauthorized("Session expired. Sign in again.");
    }

    return this.rotateWithinFamily(payload.sub, stored.familyId, meta, stored.id);
  }

  private async rotateWithinFamily(
    userId: string,
    familyId: string,
    meta: { ip?: string; ua?: string },
    previousTokenId?: string,
  ) {
    const env = getEnv();
    if (previousTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: previousTokenId },
        data: { revokedAt: new Date() },
      });
    }
    const jti = randomBytes(24).toString("hex");
    const rawRefresh = await this.jwt.signAsync(
      { sub: userId, fam: familyId, typ: REFRESH, jti },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.REFRESH_TOKEN_TTL_SECONDS },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: await sha256(rawRefresh),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000),
        userAgent: meta.ua?.slice(0, 300),
        ip: meta.ip,
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: ACCESS },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
    );
    const ctx = await this.loadAccessContext(userId);
    return { accessToken, refreshToken: rawRefresh, context: publicContext(ctx) };
  }

  async logout(refreshTokenRaw: string) {
    const tokenHash = await sha256(refreshTokenRaw);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return { ok: true };
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async switchCommunity(userId: string, communityId: string) {
    const membership = await this.prisma.communityMembership.findFirst({
      where: { userId, communityId, isActive: true },
    });
    if (!membership) throw Errors.forbidden("You are not a member of that community.", "NOT_A_MEMBER");
    await this.prisma.communityMembership.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    await this.prisma.communityMembership.update({
      where: { id: membership.id },
      data: { isDefault: true },
    });
    this.ctxCache.delete(userId);
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: ACCESS },
      { secret: getEnv().JWT_ACCESS_SECRET, expiresIn: getEnv().ACCESS_TOKEN_TTL_SECONDS },
    );
    return { accessToken, context: publicContext(await this.loadAccessContext(userId)) };
  }

  // ── Access context (permissions loaded server-side, cached briefly) ───────

  async loadAccessContext(userId: string): Promise<AccessContext> {
    const cached = this.ctxCache.get(userId);
    if (cached && Date.now() - cached.at < AuthService.CTX_TTL_MS) return cached.ctx;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: { community: { select: { name: true, status: true } }, roles: { include: { role: true } } },
        },
      },
    });
    if (!user || user.status === "DEACTIVATED") throw Errors.unauthorized("Account unavailable.");

    const memberships = user.memberships.map((m) => ({
      communityId: m.communityId,
      communityName: m.community.name,
      roleKeys: m.roles.map((r) => r.role.key),
      isDefault: m.isDefault,
    }));
    const active =
      user.memberships.find((m) => m.isDefault) ?? user.memberships[0] ?? null;

    const roleKeys = active ? active.roles.map((r) => r.role.key) : [];
    const perms = new Set<string>();
    if (user.isPlatformSuperAdmin) {
      const { ALL_PERMISSIONS } = await import("@societyos/permissions");
      for (const p of ALL_PERMISSIONS) perms.add(p);
    }
    for (const r of active?.roles ?? []) for (const p of r.role.permissions) perms.add(p);

    const ctx: AccessContext = {
      userId: user.id,
      communityId: active?.communityId,
      isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      roleKeys,
      permissions: [...perms],
      memberships,
    };
    this.ctxCache.set(userId, { at: Date.now(), ctx });
    return ctx;
  }

  invalidateUserCache(userId: string) {
    this.ctxCache.delete(userId);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private otpRecent = new Map<string, number[]>();

  /** In-process OTP throttle (per target): max 3 requests / 10 min. */
  private assertNotSpammy(target: string) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const recent = (this.otpRecent.get(target) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= 3) throw Errors.rateLimited("Too many OTP requests. Try again later.");
    recent.push(now);
    this.otpRecent.set(target, recent);
  }
}

export { normalizePhone, normalizeTarget, isEmail, maskTarget } from "@societyos/types";

import { normalizePhone, normalizeTarget, isEmail, maskTarget } from "@societyos/types";

export async function sha256(input: string): Promise<string> {
  return createHash("sha256").update(input).digest("hex");
}

export function hashTokenSync(token: string): string {
  return argonHash("sha256").update(token).digest("hex");
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export { hash, verify };
