"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
vitest_1.vi.mock('../src/config/redis', () => {
    return {
        redis: {
            incr: vitest_1.vi.fn().mockResolvedValue(1),
            expire: vitest_1.vi.fn().mockResolvedValue(1),
            get: vitest_1.vi.fn().mockResolvedValue(null),
            set: vitest_1.vi.fn().mockResolvedValue(null),
        },
    };
});
vitest_1.vi.mock('../src/config/prisma', () => {
    return {
        default: {
            patient: {
                upsert: vitest_1.vi.fn().mockResolvedValue({ id: 'patient-id', phone_number: '+2348012345678' }),
            },
        },
    };
});
const index_1 = __importDefault(require("../src/index"));
(0, vitest_1.describe)('Endpoint Zod Validation and Auth Routing', () => {
    (0, vitest_1.it)('should return 400 validation_failed on invalid request body to patient otp request', async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/auth/patient/otp/request')
            .send({ phone_number: 'short' }); // Invalid format: too short
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error).toBe('validation_failed');
        (0, vitest_1.expect)(res.body.issues).toBeDefined();
        (0, vitest_1.expect)(res.body.issues[0].path).toBe('phone_number');
    });
    (0, vitest_1.it)('should return 401 Unauthorized for route without headers', async () => {
        const res = await (0, supertest_1.default)(index_1.default).get('/patients/me');
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
