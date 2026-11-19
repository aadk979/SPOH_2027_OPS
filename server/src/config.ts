import { z } from 'zod';

/**
 * All runtime configuration comes from environment variables (12-factor),
 * validated once at startup so a misconfiguration fails fast with a clear message.
 * See .env.example for documentation of each variable.
 */
const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Comma-separated origins allowed to call the API (the client URL). */
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  /** Public URL of the client, used to build links in emails. */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  /** When true the server also serves the built client (single-server deployments). */
  SERVE_CLIENT: booleanFromString,
  CLIENT_DIST_DIR: z.string().default('../client/dist'),
  /** Email of the first CC, allowed to log in before any roster exists. */
  BOOTSTRAP_CC_EMAIL: z.string().email().optional(),
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('SPOH 2027 Ops <no-reply@localhost>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: booleanFromString,
  RESEND_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  return parsed.data;
}

/** Allowed CORS origins as a list. */
export function allowedOrigins(config: Config): string[] {
  return config.APP_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
