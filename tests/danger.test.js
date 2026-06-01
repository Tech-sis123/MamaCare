"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dangerDetection_1 = require("../src/modules/symptoms/dangerDetection");
// Mock the services and DB
vitest_1.vi.mock('../src/middleware/auth', () => {
    return {
        authenticate: (req, res, next) => {
            req.user = { id: 'patient-uuid-123', role: 'patient', type: 'patient' };
            next();
        },
    };
});
vitest_1.vi.mock('../src/middleware/rbac', () => {
    return {
        rbac: () => (req, res, next) => next(),
    };
});
vitest_1.vi.mock('../src/config/prisma', () => {
    return {
        default: {
            patient: {
                findUnique: vitest_1.vi.fn(),
            },
            symptom: {
                create: vitest_1.vi.fn(),
            },
            dangerAlert: {
                create: vitest_1.vi.fn(),
                update: vitest_1.vi.fn(),
            },
            auditLog: {
                create: vitest_1.vi.fn(),
            },
            notificationsLog: {
                create: vitest_1.vi.fn(),
            },
            systemConfig: {
                findFirst: vitest_1.vi.fn(),
            },
        },
    };
});
vitest_1.vi.mock('../src/config/redis', () => {
    const mockRedis = {
        get: vitest_1.vi.fn(),
        set: vitest_1.vi.fn(),
        lpush: vitest_1.vi.fn(),
        ltrim: vitest_1.vi.fn(),
        publish: vitest_1.vi.fn(),
    };
    return {
        redis: mockRedis,
    };
});
vitest_1.vi.mock('../src/services/termii', () => {
    return {
        termiiService: {
            sendSMS: vitest_1.vi.fn().mockResolvedValue({ message_id: 'sms-123' }),
        },
    };
});
vitest_1.vi.mock('../src/services/whatsapp', () => {
    return {
        whatsappService: {
            sendMessage: vitest_1.vi.fn().mockResolvedValue({ message_id: 'wa-123' }),
        },
    };
});
(0, vitest_1.describe)('Danger Sign Detection Rules', () => {
    (0, vitest_1.it)('should detect vaginal bleeding of any severity', () => {
        const symptoms = [{ symptom_key: 'vaginal_bleeding', severity: 'mild' }];
        const res = (0, dangerDetection_1.detectDangerSigns)(symptoms, {});
        (0, vitest_1.expect)(res.is_danger).toBe(true);
        (0, vitest_1.expect)(res.triggers[0].trigger_key).toBe('vaginal_bleeding');
    });
    (0, vitest_1.it)('should detect severe abdominal pain', () => {
        const symptoms = [{ symptom_key: 'abdominal_pain', severity: 'severe' }];
        const res = (0, dangerDetection_1.detectDangerSigns)(symptoms, {});
        (0, vitest_1.expect)(res.is_danger).toBe(true);
        (0, vitest_1.expect)(res.triggers[0].trigger_key).toBe('severe_abdominal_pain');
    });
    (0, vitest_1.it)('should NOT trigger for moderate abdominal pain', () => {
        const symptoms = [{ symptom_key: 'abdominal_pain', severity: 'moderate' }];
        const res = (0, dangerDetection_1.detectDangerSigns)(symptoms, {});
        (0, vitest_1.expect)(res.is_danger).toBe(false);
    });
    (0, vitest_1.it)('should detect reduced fetal movement after 28 weeks', () => {
        const symptoms = [{ symptom_key: 'reduced_fetal_movement', severity: 'mild' }];
        const res = (0, dangerDetection_1.detectDangerSigns)(symptoms, { ega_weeks: 30 });
        (0, vitest_1.expect)(res.is_danger).toBe(true);
        (0, vitest_1.expect)(res.triggers[0].trigger_key).toBe('reduced_fetal_movement');
    });
    (0, vitest_1.it)('should NOT detect reduced fetal movement before 28 weeks', () => {
        const symptoms = [{ symptom_key: 'reduced_fetal_movement', severity: 'mild' }];
        const res = (0, dangerDetection_1.detectDangerSigns)(symptoms, { ega_weeks: 24 });
        (0, vitest_1.expect)(res.is_danger).toBe(false);
    });
    (0, vitest_1.it)('should detect severe headache with high BP', () => {
        const symptoms = [{ symptom_key: 'severe_headache', severity: 'moderate' }];
        const res = (0, dangerDetection_1.detectDangerSigns)(symptoms, { bp_systolic: 145, bp_diastolic: 95 });
        (0, vitest_1.expect)(res.is_danger).toBe(true);
        (0, vitest_1.expect)(res.triggers[0].trigger_key).toBe('headache_high_bp');
    });
});
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("../src/modules/symptoms/routes"));
const prisma_1 = __importDefault(require("../src/config/prisma"));
const redis_1 = require("../src/config/redis");
const termii_1 = require("../src/services/termii");
const whatsapp_1 = require("../src/services/whatsapp");
(0, vitest_1.describe)('Danger Alert Pipeline Integration', () => {
    let app;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Mock a simple auth middleware injecting patient user
        app.use((req, res, next) => {
            req.user = { id: 'patient-uuid-123', role: 'patient', type: 'patient' };
            next();
        });
        app.use('/symptoms', routes_1.default);
    });
    (0, vitest_1.it)('should execute the 4 core side-effects when danger signs are logged', async () => {
        // 1. Setup mocks
        vitest_1.vi.mocked(redis_1.redis.get).mockResolvedValue(null); // No cached idempotency response
        vitest_1.vi.mocked(prisma_1.default.patient.findUnique).mockResolvedValue({
            id: 'patient-uuid-123',
            phone_number: '+2348012345678',
            name: 'Jane Doe',
            primary_doctor_id: 'doctor-uuid-999',
            age: 26,
            education_level: null,
            occupation: null,
            marital_status: null,
            address: null,
            religion: null,
            ethnicity: null,
            language_preference: 'en',
            created_at: new Date(),
            pregnancies: [],
        });
        vitest_1.vi.mocked(prisma_1.default.symptom.create).mockResolvedValue({});
        vitest_1.vi.mocked(prisma_1.default.dangerAlert.create).mockResolvedValue({
            id: 'alert-uuid-555',
            patient_id: 'patient-uuid-123',
            doctor_id: 'doctor-uuid-999',
            triggers: [],
            severity: 'critical',
            status: 'open',
            sms_sent_at: null,
            whatsapp_sent_at: null,
            acknowledged_at: null,
            created_at: new Date(),
        });
        const response = await (0, supertest_1.default)(app)
            .post('/symptoms')
            .set('Idempotency-Key', 'unique-key-111')
            .send({
            symptoms: [
                { symptom_key: 'vaginal_bleeding', severity: 'moderate', notes: 'Spotted morning' },
            ],
        });
        // Expecting 201 Created and emergency payload response
        if (response.status !== 201) {
            console.error('Test failed with error:', response.body);
        }
        (0, vitest_1.expect)(response.status).toBe(201);
        (0, vitest_1.expect)(response.body.danger_alert.severity).toBe('critical');
        // Assertion 1: Postgres DangerAlert Row Written
        (0, vitest_1.expect)(prisma_1.default.dangerAlert.create).toHaveBeenCalled();
        // Assertion 2: SMS sent via Termii to Patient
        (0, vitest_1.expect)(termii_1.termiiService.sendSMS).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            to: '+2348012345678',
            sms: vitest_1.expect.stringContaining('Vaginal bleeding'),
        }));
        // Assertion 3: WhatsApp message sent via Meta API
        (0, vitest_1.expect)(whatsapp_1.whatsappService.sendMessage).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            to: '+2348012345678',
            message: vitest_1.expect.stringContaining('Vaginal bleeding'),
        }));
        // Assertion 4: Redis LPUSH and PUBLISH to doctor
        (0, vitest_1.expect)(redis_1.redis.lpush).toHaveBeenCalledWith('doctor:doctor-uuid-999:active_alerts', vitest_1.expect.stringContaining('alert-uuid-555'));
        (0, vitest_1.expect)(redis_1.redis.publish).toHaveBeenCalledWith('doctor:doctor-uuid-999:alerts', vitest_1.expect.stringContaining('alert-uuid-555'));
    });
});
