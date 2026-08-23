import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('3001')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().min(1).max(65535)),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('production'),

  // SMTP / OCI Email Delivery
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z
    .string()
    .default('587')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().min(1).max(65535)),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  DEFAULT_FROM: z.string().min(1, 'DEFAULT_FROM is required'),

  // Comma-separated list of authorized API keys
  ALLOWED_API_KEYS: z
    .string()
    .min(1, 'ALLOWED_API_KEYS must contain at least one key')
    .transform((v) =>
      v
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
