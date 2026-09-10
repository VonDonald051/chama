import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@chama/database';
import type { AppConfig } from '../config.js';
import type { Principal } from '../lib/policy.js';
import { secureEquals, sha256 } from '../lib/security.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

function sessionToken(request: FastifyRequest, config: AppConfig): string | undefined {
  return request.cookies[config.SESSION_COOKIE_NAME];
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply, config: AppConfig, options?: { requireMfa?: boolean }) {
  const token = sessionToken(request, config);
  if (!token) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED', requestId: request.id });

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: sha256(token),
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    include: { user: { include: { roles: { include: { role: { select: { code: true } } } } } } },
  });
  if (!session || session.user.status !== 'ACTIVE') {
    return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED', requestId: request.id });
  }
  if (options?.requireMfa !== false && !session.mfaCompletedAt) {
    return reply.code(403).send({ error: 'MFA_REQUIRED', requestId: request.id });
  }

  request.principal = {
    userId: session.userId,
    sessionId: session.id,
    roles: session.user.roles.map(({ role }) => role.code),
    mfaComplete: Boolean(session.mfaCompletedAt),
  };
  void prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
}

export async function requireCsrf(request: FastifyRequest, reply: FastifyReply, config: AppConfig) {
  const principal = request.principal;
  if (!principal) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED', requestId: request.id });
  const token = request.headers['x-csrf-token'];
  if (typeof token !== 'string' || token.length < 32) {
    return reply.code(403).send({ error: 'CSRF_VALIDATION_FAILED', requestId: request.id });
  }
  const session = await prisma.session.findUnique({ where: { id: principal.sessionId }, select: { csrfTokenHash: true } });
  if (!session || !secureEquals(sha256(token), session.csrfTokenHash)) {
    return reply.code(403).send({ error: 'CSRF_VALIDATION_FAILED', requestId: request.id });
  }
}
