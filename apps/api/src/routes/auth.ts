import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { Secret, TOTP } from 'otpauth';
import { z } from 'zod';
import { prisma } from '@chama/database';
import type { AppConfig } from '../config.js';
import { appendAudit } from '../lib/audit.js';
import { RoleCode } from '../lib/policy.js';
import { decryptField, encryptField, privacyHash, randomToken, sha256 } from '../lib/security.js';
import { requireCsrf, requireSession } from '../plugins/auth.js';

const loginBody = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(12).max(128),
});
const activationBody = z.object({
  token: z.string().min(32).max(512),
  password: z.string().min(12).max(128),
});
const codeBody = z.object({ code: z.string().regex(/^\d{6}$/) });

const passwordOptions: argon2.Options & { type: typeof argon2.argon2id } = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
};

function requesterIp(request: { ip: string }): string { return request.ip || 'unknown'; }
function requesterAgent(request: { headers: Record<string, string | string[] | undefined> }): string {
  const value = request.headers['user-agent'];
  return typeof value === 'string' ? value.slice(0, 512) : 'unknown';
}
function normalizeIdentifier(identifier: string): string { return identifier.trim().toLowerCase(); }
function privileged(roles: string[]): boolean {
  const privilegedRoles = new Set<string>([RoleCode.OWNER, RoleCode.SUPER_ADMIN, RoleCode.ADMIN, RoleCode.GROUP_ADMIN]);
  return roles.some((role) => privilegedRoles.has(role));
}

async function recordLoginFailure(
  identifier: string,
  userId: string | undefined,
  request: { id: string; ip: string; headers: Record<string, string | string[] | undefined> },
  config: AppConfig,
): Promise<void> {
  const identifierHash = privacyHash(identifier, config);
  const ipHash = privacyHash(requesterIp(request), config);
  const userAgentHash = privacyHash(requesterAgent(request), config);

  await prisma.$transaction(async (tx) => {
    await tx.loginAttempt.create({
      data: { userId, identifierHash, success: false, failureReason: 'INVALID_CREDENTIALS', ipHash, userAgentHash },
    });
    if (!userId) return;

    const updated = await tx.user.update({
      where: { id: userId },
      data: { loginFailedCount: { increment: 1 } },
      select: { loginFailedCount: true },
    });
    if (updated.loginFailedCount < 4) return;

    const lockedUntil = new Date(Date.now() + 15 * 60_000);
    await tx.user.update({ where: { id: userId }, data: { status: 'LOCKED', lockedUntil } });
    await tx.securityEvent.create({
      data: {
        subjectUserId: userId,
        type: 'AUTHENTICATION_FAILURE_THRESHOLD',
        severity: 'HIGH',
        ipHash,
        metadata: { failedAttemptCount: updated.loginFailedCount, temporaryLockMinutes: 15 },
      },
    });
    const owners = await tx.user.findMany({
      where: { status: 'ACTIVE', roles: { some: { role: { code: RoleCode.OWNER } } } },
      select: { id: true },
    });
    if (owners.length) {
      await tx.notification.createMany({
        data: owners.map((owner) => ({
          userId: owner.id,
          type: 'SECURITY',
          title: 'Security alert: authentication threshold reached',
          body: 'An account reached the failed authentication threshold. Review the security alert center.',
          metadata: { severity: 'HIGH', eventType: 'AUTHENTICATION_FAILURE_THRESHOLD' },
        })),
      });
    }
  });

  await appendAudit({
    actorUserId: userId,
    action: 'AUTH_LOGIN_FAILED',
    targetType: 'USER',
    targetId: userId,
    outcome: 'FAILURE',
    requestId: request.id,
    sourceIpHash: ipHash,
    reason: 'INVALID_CREDENTIALS',
  });
}

export async function authRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.post('/api/v1/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes', keyGenerator: (request) => requesterIp(request) } },
  }, async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', requestId: request.id });

    const identifier = normalizeIdentifier(parsed.data.identifier);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { emailNormalized: identifier },
          { memberProfile: { phoneE164: parsed.data.identifier.trim() } },
        ],
      },
      include: { roles: { include: { role: { select: { code: true } } } }, mfaFactors: { where: { verifiedAt: { not: null } }, select: { id: true } } },
    });

    const isLocked = user?.status === 'LOCKED' && user.lockedUntil && user.lockedUntil > new Date();
    const valid = Boolean(user && user.status === 'ACTIVE' && !isLocked && user.passwordHash && await argon2.verify(user.passwordHash, parsed.data.password));
    if (!valid) {
      await recordLoginFailure(identifier, user?.id, request, config);
      // Identical response prevents account enumeration.
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS', requestId: request.id });
    }

    // `valid` above already requires a user; this guard keeps the narrowed type explicit.
    if (!user) return reply.code(401).send({ error: 'INVALID_CREDENTIALS', requestId: request.id });
    const roleCodes = user.roles.map(({ role }) => role.code);
    const mfaRequired = privileged(roleCodes);
    const mfaComplete = !mfaRequired;
    const rawSession = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60_000);
    const ipHash = privacyHash(requesterIp(request), config);
    const userAgentHash = privacyHash(requesterAgent(request), config);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { loginFailedCount: 0, lastLoginAt: new Date() } }),
      prisma.loginAttempt.create({ data: { userId: user.id, identifierHash: privacyHash(identifier, config), success: true, ipHash, userAgentHash } }),
      prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: sha256(rawSession),
          csrfTokenHash: sha256(csrfToken),
          expiresAt,
          mfaCompletedAt: mfaComplete ? new Date() : null,
          ipHash,
          userAgentHash,
        },
      }),
    ]);

    reply.setCookie(config.SESSION_COOKIE_NAME, rawSession, {
      path: '/', httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', maxAge: config.SESSION_TTL_HOURS * 60 * 60,
    });
    await appendAudit({ actorUserId: user.id, actorRoleSnapshot: roleCodes.join(','), action: 'AUTH_LOGIN_SUCCESS', targetType: 'SESSION', outcome: 'SUCCESS', requestId: request.id, sourceIpHash: ipHash });
    return reply.send({
      authenticated: mfaComplete,
      mfaRequired,
      mfaEnrollmentRequired: mfaRequired && user.mfaFactors.length === 0,
      csrfToken,
    });
  });

  app.post('/api/v1/auth/invitations/activate', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = activationBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', requestId: request.id });
    const invitation = await prisma.invitation.findFirst({
      where: { tokenHash: sha256(parsed.data.token), status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!invitation) return reply.code(400).send({ error: 'INVALID_OR_EXPIRED_INVITATION', requestId: request.id });

    const passwordHash = await argon2.hash(parsed.data.password, passwordOptions);
    await prisma.$transaction([
      prisma.user.update({ where: { id: invitation.userId }, data: { passwordHash, status: 'ACTIVE', forcePasswordChange: false, loginFailedCount: 0, lockedUntil: null } }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', consumedAt: new Date() } }),
    ]);
    await appendAudit({ actorUserId: invitation.userId, action: 'INVITATION_ACTIVATED', targetType: 'INVITATION', targetId: invitation.id, outcome: 'SUCCESS', requestId: request.id, sourceIpHash: privacyHash(requesterIp(request), config) });
    return reply.code(204).send();
  });

  app.post('/api/v1/auth/mfa/totp/enroll', async (request, reply) => {
    await requireSession(request, reply, config, { requireMfa: false });
    if (!request.principal) return;
    await requireCsrf(request, reply, config);
    if (reply.sent) return;

    const user = await prisma.user.findUnique({ where: { id: request.principal.userId }, select: { emailNormalized: true } });
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({ issuer: 'Chama Platform', label: user?.emailNormalized ?? request.principal.userId, algorithm: 'SHA1', digits: 6, period: 30, secret });
    await prisma.mFAFactor.deleteMany({ where: { userId: request.principal.userId, kind: 'TOTP', verifiedAt: null } });
    await prisma.mFAFactor.create({ data: { userId: request.principal.userId, kind: 'TOTP', encryptedSecret: encryptField(secret.base32, config) } });
    await appendAudit({ actorUserId: request.principal.userId, action: 'MFA_TOTP_ENROLLMENT_STARTED', targetType: 'MFA_FACTOR', outcome: 'SUCCESS', requestId: request.id, sourceIpHash: privacyHash(requesterIp(request), config) });
    return reply.send({ otpauthUri: totp.toString() });
  });

  app.post('/api/v1/auth/mfa/verify', async (request, reply) => {
    await requireSession(request, reply, config, { requireMfa: false });
    if (!request.principal) return;
    await requireCsrf(request, reply, config);
    if (reply.sent) return;
    const parsed = codeBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', requestId: request.id });

    const factor = await prisma.mFAFactor.findFirst({ where: { userId: request.principal.userId, kind: 'TOTP' }, orderBy: { createdAt: 'desc' } });
    if (!factor?.encryptedSecret) return reply.code(400).send({ error: 'MFA_FACTOR_NOT_ENROLLED', requestId: request.id });
    const totp = new TOTP({ issuer: 'Chama Platform', label: request.principal.userId, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(decryptField(factor.encryptedSecret, config)) });
    if (totp.validate({ token: parsed.data.code, window: 1 }) === null) {
      await appendAudit({ actorUserId: request.principal.userId, action: 'MFA_VERIFICATION_FAILED', targetType: 'MFA_FACTOR', targetId: factor.id, outcome: 'FAILURE', requestId: request.id, sourceIpHash: privacyHash(requesterIp(request), config) });
      return reply.code(401).send({ error: 'INVALID_MFA_CODE', requestId: request.id });
    }
    await prisma.$transaction([
      prisma.mFAFactor.update({ where: { id: factor.id }, data: { verifiedAt: factor.verifiedAt ?? new Date(), lastUsedAt: new Date() } }),
      prisma.session.update({ where: { id: request.principal.sessionId }, data: { mfaCompletedAt: new Date() } }),
    ]);
    await appendAudit({ actorUserId: request.principal.userId, action: 'MFA_VERIFIED', targetType: 'MFA_FACTOR', targetId: factor.id, outcome: 'SUCCESS', requestId: request.id, sourceIpHash: privacyHash(requesterIp(request), config) });
    return reply.code(204).send();
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await requireSession(request, reply, config, { requireMfa: false });
    if (!request.principal) return;
    await requireCsrf(request, reply, config);
    if (reply.sent) return;
    await prisma.session.update({ where: { id: request.principal.sessionId }, data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'USER_LOGOUT' } });
    reply.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
    await appendAudit({ actorUserId: request.principal.userId, action: 'AUTH_LOGOUT', targetType: 'SESSION', targetId: request.principal.sessionId, outcome: 'SUCCESS', requestId: request.id, sourceIpHash: privacyHash(requesterIp(request), config) });
    return reply.code(204).send();
  });
}
