"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskController = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const engine_1 = require("./engine");
const errors_1 = require("../../utils/errors");
const logger_1 = require("../../utils/logger");
exports.riskController = {
    /**
     * POST /risk/:patientId/run
     * Runs the pure-function risk engine, persists result, writes audit log.
     */
    async runRisk(req, res, next) {
        try {
            const { patientId } = req.params;
            // Fetch patient and pregnancy data
            const patient = await prisma_1.default.patient.findUnique({
                where: { id: patientId },
                include: {
                    pregnancies: { orderBy: { id: 'desc' }, take: 1 },
                    intake_responses: true,
                },
            });
            if (!patient) {
                throw new errors_1.NotFoundError('Patient not found');
            }
            const pregnancy = patient.pregnancies[0] || null;
            // Extract medical history from intake responses
            const intakeMap = new Map();
            for (const ir of patient.intake_responses) {
                intakeMap.set(ir.question_key, ir.answer);
            }
            // Build the risk input snapshot
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
                hiv_positive: pregnancy?.rvd_status === 'positive' ? true :
                    pregnancy?.rvd_status === 'negative' ? false : null,
            };
            // Run the PURE FUNCTION engine
            const result = (0, engine_1.runRiskEngine)(riskInput);
            // Persist the assessment
            const assessment = await prisma_1.default.riskAssessment.create({
                data: {
                    patient_id: patientId,
                    tier: result.tier,
                    reasons: result.reasons,
                    engine_version: result.engine_version,
                    input_snapshot: riskInput,
                },
            });
            // Write audit log
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: 'system',
                    actor_id: 'risk_engine',
                    action: 'risk_assessment_run',
                    resource_type: 'risk_assessment',
                    resource_id: assessment.id,
                    before: null,
                    after: {
                        tier: result.tier,
                        reasons: result.reasons,
                        engine_version: result.engine_version,
                        input_snapshot: riskInput,
                    },
                },
            });
            logger_1.logger.info({ patientId, tier: result.tier, engine_version: result.engine_version }, 'Risk assessment completed');
            res.status(200).json({
                id: assessment.id,
                tier: result.tier,
                reasons: result.reasons,
                engine_version: result.engine_version,
            });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /risk/:patientId/latest
     * Returns the most recent risk assessment for a patient.
     */
    async getLatest(req, res, next) {
        try {
            const { patientId } = req.params;
            const assessment = await prisma_1.default.riskAssessment.findFirst({
                where: { patient_id: patientId },
                orderBy: { created_at: 'desc' },
            });
            if (!assessment) {
                throw new errors_1.NotFoundError('No risk assessment found for this patient');
            }
            res.status(200).json({
                id: assessment.id,
                tier: assessment.tier,
                reasons: assessment.reasons,
                engine_version: assessment.engine_version,
                created_at: assessment.created_at,
            });
        }
        catch (err) {
            next(err);
        }
    },
};
