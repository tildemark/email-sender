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

  // Comma-separated list of fallback static authorized API keys
  ALLOWED_API_KEYS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    ),

  // Master Admin Key (for administrative access / API key management)
  ADMIN_API_KEY: z.string().optional(),

  // Dashboard Basic Auth (optional protection for browser UI)
  DASHBOARD_USERNAME: z.string().default('admin'),
  DASHBOARD_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
