import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@chama/database';
import { getConfig } from './config.js';
import { authRoutes } from './routes/auth.js';
import { memberFinanceRoutes } from './routes/member-finance.js';

const config = getConfig();
const app = Fastify({
  logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug', redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] },
  trustProxy: config.NODE_ENV !== 'development',
  bodyLimit: 256 * 1024,
  requestIdHeader: 'x-request-id',
});

await app.register(cookie);
await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: config.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
});
await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute', ban: 2, errorResponseBuilder: (_request, context) => ({ error: 'RATE_LIMITED', retryAfterSeconds: Math.ceil(context.ttl / 1000) }) });

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error, requestId: request.id }, 'Unhandled request failure');
  const message = error instanceof Error ? error.message : '';
  if (message === 'FORBIDDEN_SCOPE' || message === 'FORBIDDEN_ACTION') {
    return reply.code(403).send({ error: 'FORBIDDEN', requestId: request.id });
  }
  return reply.code(500).send({ error: 'UNEXPECTED_ERROR', requestId: request.id });
});

app.get('/health', async (_request, reply) => {
  await prisma.$queryRaw`SELECT 1`;
  return reply.send({ status: 'ok' });
});

app.get('/api/v1/public/portal', async (_request, reply) => {
  const portal = await prisma.systemConfiguration.findUnique({ where: { id: 'global' }, select: { systemName: true } });
  if (!portal) return reply.code(503).send({ error: 'SYSTEM_CONFIGURATION_UNAVAILABLE' });
  return reply.send({ systemName: portal.systemName });
});

await authRoutes(app, config);
await memberFinanceRoutes(app, config);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Graceful shutdown initiated');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: config.HOST });
