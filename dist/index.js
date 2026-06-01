"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const requestId_1 = require("./middleware/requestId");
const prisma_1 = __importDefault(require("./config/prisma"));
const redis_1 = require("./config/redis");
const whatsapp_1 = require("./services/whatsapp");
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
app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN }));
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
        logger_1.logger.info(`🏥 Mama Care AI server listening on port ${PORT}`);
    });
}
exports.default = app;
