import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  TERMII_API_KEY: z.string().default(''),
  TERMII_SENDER_ID: z.string().default('MamaCare'),
  TERMII_BASE_URL: z.string().default('https://api.ng.termii.com/api'),
  BREVO_API_KEY: z.string().default(''),
  BREVO_SENDER_EMAIL: z.string().default('noreply@mamacare.ng'),
  SENTRY_DSN: z.string().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),
  OPENAI_API_KEY: z.string().default(''),
  CRON_SECRET: z.string().default('my-super-secret-cron-key'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

// Automatically construct REDIS_URL if Upstash REST parameters are provided
if (data.UPSTASH_REDIS_REST_URL && data.UPSTASH_REDIS_REST_TOKEN) {
  const host = data.UPSTASH_REDIS_REST_URL.replace(/^https?:\/\//, '');
  data.REDIS_URL = `rediss://default:${data.UPSTASH_REDIS_REST_TOKEN}@${host}:6379`;
}

export const env = data;
