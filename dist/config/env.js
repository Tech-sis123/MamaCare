"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3000'),
    DATABASE_URL: zod_1.z.string(),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    UPSTASH_REDIS_REST_URL: zod_1.z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().min(16),
    JWT_ACCESS_EXPIRY: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRY: zod_1.z.string().default('7d'),
    TERMII_API_KEY: zod_1.z.string().default(''),
    TERMII_SENDER_ID: zod_1.z.string().default('MamaCare'),
    TERMII_BASE_URL: zod_1.z.string().default('https://api.ng.termii.com/api'),
    BREVO_API_KEY: zod_1.z.string().default(''),
    BREVO_SENDER_EMAIL: zod_1.z.string().default('noreply@mamacare.ng'),
    SENTRY_DSN: zod_1.z.string().default(''),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    LOG_LEVEL: zod_1.z.string().default('info'),
    OPENAI_API_KEY: zod_1.z.string().default(''),
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
exports.env = data;
