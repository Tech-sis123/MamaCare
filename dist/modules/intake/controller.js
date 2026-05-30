"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intakeController = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const errors_1 = require("../../utils/errors");
const logger_1 = require("../../utils/logger");
exports.intakeController = {
    /**
     * PATCH /intake/:patientId
     * Partial save — one question or one domain at a time.
     * Upserts each response by patient_id + domain + question_key.
     */
    async patchIntake(req, res, next) {
        try {
            const { patientId } = req.params;
            const { domain, responses } = req.body;
            // Verify patient exists
            const patient = await prisma_1.default.patient.findUnique({ where: { id: patientId } });
            if (!patient) {
                throw new errors_1.NotFoundError('Patient not found');
            }
            const upserted = [];
            for (const resp of responses) {
                const existing = await prisma_1.default.intakeResponse.findFirst({
                    where: {
                        patient_id: patientId,
                        domain,
                        question_key: resp.question_key,
                    },
                });
                if (existing) {
                    const updated = await prisma_1.default.intakeResponse.update({
                        where: { id: existing.id },
                        data: { answer: resp.answer },
                    });
                    upserted.push(updated);
                }
                else {
                    const created = await prisma_1.default.intakeResponse.create({
                        data: {
                            patient_id: patientId,
                            domain,
                            question_key: resp.question_key,
                            answer: resp.answer,
                        },
                    });
                    upserted.push(created);
                }
            }
            // Audit log
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: 'patient',
                    actor_id: patientId,
                    action: 'intake_partial_save',
                    resource_type: 'intake_response',
                    resource_id: patientId,
                    before: null,
                    after: { domain, question_count: responses.length },
                },
            });
            res.status(200).json({ saved: upserted.length, domain });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /intake/:patientId
     * Return everything captured so far, grouped by domain.
     */
    async getIntake(req, res, next) {
        try {
            const { patientId } = req.params;
            const responses = await prisma_1.default.intakeResponse.findMany({
                where: { patient_id: patientId },
                orderBy: [{ domain: 'asc' }, { question_key: 'asc' }],
            });
            // Group by domain
            const grouped = {};
            for (const r of responses) {
                if (!grouped[r.domain])
                    grouped[r.domain] = [];
                grouped[r.domain].push({
                    question_key: r.question_key,
                    answer: r.answer,
                    updated_at: r.updated_at,
                });
            }
            res.status(200).json({ patient_id: patientId, domains: grouped });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /intake/:patientId/submit
     * Marks intake as complete, triggers risk engine internally.
     */
    async submitIntake(req, res, next) {
        try {
            const { patientId } = req.params;
            // Verify patient exists
            const patient = await prisma_1.default.patient.findUnique({ where: { id: patientId } });
            if (!patient) {
                throw new errors_1.NotFoundError('Patient not found');
            }
            // Internally trigger risk engine (import the controller)
            // We do a direct import to call the risk run logic
            const { riskController } = await Promise.resolve().then(() => __importStar(require('../risk/controller')));
            // Create a mock request/response to call the risk controller
            // Instead, let's directly call the engine and persist
            const { runRiskEngine } = await Promise.resolve().then(() => __importStar(require('../risk/engine')));
            const pregnancy = await prisma_1.default.pregnancy.findFirst({
                where: { patient_id: patientId },
                orderBy: { id: 'desc' },
            });
            const intakeResponses = await prisma_1.default.intakeResponse.findMany({
                where: { patient_id: patientId },
            });
            const intakeMap = new Map();
            for (const ir of intakeResponses) {
                intakeMap.set(ir.question_key, ir.answer);
            }
            const riskInput = {
                age: patient.age,
                bp_systolic: pregnancy?.booking_bp_systolic ?? null,
                bp_diastolic: pregnancy?.booking_bp_diastolic ?? null,
                hemoglobin: pregnancy?.pcv ?? null,
                genotype: pregnancy?.genotype ?? null,
                previous_csection: intakeMap.get('previous_csection') ?? null,
                previous_stillbirth: intakeMap.get('previous_stillbirth') ?? null,
                previous_eclampsia: intakeMap.get('previous_eclampsia') ?? null,
                parity: pregnancy?.parity ?? null,
                is_twin_pregnancy: intakeMap.get('is_twin_pregnancy') ?? null,
                hiv_positive: pregnancy?.rvd_status === 'positive'
                    ? true
                    : pregnancy?.rvd_status === 'negative'
                        ? false
                        : null,
            };
            const result = runRiskEngine(riskInput);
            const assessment = await prisma_1.default.riskAssessment.create({
                data: {
                    patient_id: patientId,
                    tier: result.tier,
                    reasons: result.reasons,
                    engine_version: result.engine_version,
                    input_snapshot: riskInput,
                },
            });
            // Audit
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: 'patient',
                    actor_id: patientId,
                    action: 'intake_submitted',
                    resource_type: 'intake_response',
                    resource_id: patientId,
                    before: null,
                    after: { risk_tier: result.tier, assessment_id: assessment.id },
                },
            });
            logger_1.logger.info({ patientId, tier: result.tier }, 'Intake submitted, risk assessed');
            res.status(200).json({
                message: 'Intake submitted successfully',
                risk: {
                    id: assessment.id,
                    tier: result.tier,
                    reasons: result.reasons,
                    engine_version: result.engine_version,
                },
            });
        }
        catch (err) {
            next(err);
        }
    },
};
