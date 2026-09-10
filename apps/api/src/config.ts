import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url(),
  SESSION_COOKIE_NAME: z.string().min(8).default('__Host-chama_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  COOKIE_SECURE: bool.default('true'),
  AUDIT_HASH_KEY: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(43), // base64-encoded 32-byte local/dev key; KMS envelope key in production
});

export type AppConfig = z.infer<typeof schema>;

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Only validation paths are emitted: environment values and secrets never reach logs.
    throw new Error(`Invalid server configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  if (result.data.NODE_ENV === 'production' && !result.data.COOKIE_SECURE) {
    throw new Error('Invalid server configuration: COOKIE_SECURE');
  }
  return result.data;
}
