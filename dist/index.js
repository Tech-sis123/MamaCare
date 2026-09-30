"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const requestId_1 = require("./middleware/requestId");
const prisma_1 = __importDefault(require("./config/prisma"));
const redis_1 = require("./config/redis");
const whatsapp_1 = require("./services/whatsapp");
const appointmentReminder_1 = require("./jobs/appointmentReminder");
const educationDispatcher_1 = require("./jobs/educationDispatcher");
const retentionSms_1 = require("./jobs/retentionSms");
// ─── Route imports ──────────────────────────────────────────
const routes_1 = __importDefault(require("./modules/auth/routes"));
const routes_2 = __importDefault(require("./modules/patients/routes"));
const routes_3 = __importDefault(require("./modules/intake/routes"));
const routes_4 = __importDefault(require("./modules/risk/routes"));
const routes_5 = __importDefault(require("./modules/symptoms/routes"));
const routes_6 = require("./modules/symptoms/routes");
const routes_7 = __importDefault(require("./modules/alerts/routes"));
const routes_8 = __importDefault(require("./modules/appointments/routes"));
const routes_9 = __importDefault(require("./modules/education/routes"));
const routes_10 = __importDefault(require("./modules/providers/routes"));
const routes_11 = __importDefault(require("./modules/admin/routes"));
const app = (0, express_1.default)();
// ─── Global Middleware ──────────────────────────────────────
// Manual preflight handler — Express 5 + path-to-regexp v8 breaks
// app.options('*', cors()), so we catch OPTIONS here before routing.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key');
    if (req.method === 'OPTIONS') {
        logger_1.logger.info({ path: req.path }, '✅ Preflight OPTIONS handled');
        res.status(204).end();
        return;
    }
    next();
});
app.use(express_1.default.json());
app.use(requestId_1.requestId);
app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
// ─── Health Check ───────────────────────────────────────────
app.get('/health', async (req, res) => {
    let dbStatus = 'ok';
    let redisStatus = 'ok';
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
    }
    catch {
        dbStatus = 'error';
    }
    try {
        await redis_1.redis.ping();
    }
    catch {
        redisStatus = 'error';
    }
    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 200 : 503;
    res.status(status).json({
        status: status === 200 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: { database: dbStatus, redis: redisStatus },
    });
});
// ─── Cron Webhooks ──────────────────────────────────────────
app.get('/cron/reminders', async (req, res, next) => {
    try {
        const secret = req.query.secret;
        if (secret !== env_1.env.CRON_SECRET) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Run asynchronously so we don't block the response for UptimeRobot
        (0, appointmentReminder_1.processAppointmentReminders)().catch((err) => {
            logger_1.logger.error({ err }, 'Background reminder execution failed');
        });
        res.status(200).json({ status: 'ok', message: 'Reminders triggered in the background' });
    }
    catch (err) {
        next(err);
    }
});
app.get('/cron/education', async (req, res, next) => {
    try {
        if (req.query.secret !== env_1.env.CRON_SECRET) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        (0, educationDispatcher_1.dispatchWeeklyEducation)().catch((err) => {
            logger_1.logger.error({ err }, 'Background education dispatch failed');
        });
        res.status(200).json({ status: 'ok', message: 'Education SMS dispatch triggered' });
    }
    catch (err) {
        next(err);
    }
});
app.get('/cron/retention', async (req, res, next) => {
    try {
        if (req.query.secret !== env_1.env.CRON_SECRET) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        (0, retentionSms_1.processRetentionSms)()
            .then((result) => logger_1.logger.info(result, 'Retention SMS finished'))
            .catch((err) => logger_1.logger.error({ err }, 'Background retention SMS failed'));
        res.status(200).json({ status: 'ok', message: 'Retention SMS triggered' });
    }
    catch (err) {
        next(err);
    }
});
// ─── Routes ─────────────────────────────────────────────────
app.use('/auth', routes_1.default);
app.use('/patients', routes_2.default);
app.use('/patients', routes_6.symptomTimelineRouter); // GET /patients/:id/symptoms
app.use('/intake', routes_3.default);
app.use('/risk', routes_4.default);
app.use('/symptoms', routes_5.default);
app.use('/alerts', routes_7.default);
app.use('/appointments', routes_8.default);
app.use('/education', routes_9.default);
app.use('/providers', routes_10.default);
app.use('/admin', routes_11.default);
// ─── Error Handler ──────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ─── Start Server ───────────────────────────────────────────
const PORT = parseInt(env_1.env.PORT, 10);
if (env_1.env.NODE_ENV !== 'test') {
    (0, whatsapp_1.initWhatsApp)();
    app.listen(PORT, () => {
        logger_1.logger.info(`🏥 9Care AI server listening on port ${PORT}`);
    });
}
exports.default = app;
