"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.educationController = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const redis_1 = require("../../config/redis");
const errors_1 = require("../../utils/errors");
const ega_calculator_1 = require("../../services/ega-calculator");
const ai_1 = require("../../services/ai");
const logger_1 = require("../../utils/logger");
exports.educationController = {
    /**
     * GET /education/modules?week=...
     * List education modules, customized based on the patient's profile:
     * - Computes current EGA weeks from LMP.
     * - Automatically generates/personalizes lesson dynamically via OpenAI (cached in Redis).
     * - Gracefully falls back to pre-seeded clinical modules if OpenAI is disabled.
     * - Automatically recommends danger sign safety lessons if they are medium/high risk.
     * - Integrates completion status for every module.
     */
    async listModules(req, res, next) {
        try {
            const user = req.user;
            const weekQuery = req.query.week ? Number(req.query.week) : undefined;
            const where = { status: 'published' };
            if (weekQuery) {
                where.week_number = weekQuery;
            }
            // Fetch all published modules
            const modules = await prisma_1.default.educationModule.findMany({
                where,
                orderBy: { week_number: 'asc' },
            });
            // If doctor/admin fetches, return plain list
            if (user.role !== 'patient') {
                res.status(200).json({ modules });
                return;
            }
            // ─── Patient Custom Personalization ──────────────────────
            const patientId = user.id;
            // 1. Fetch patient details, latest pregnancy, and latest risk assessment
            const patient = await prisma_1.default.patient.findUnique({
                where: { id: patientId },
                include: {
                    pregnancies: { orderBy: { id: 'desc' }, take: 1 },
                    risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
                    education_progresses: true,
                },
            });
            if (!patient) {
                res.status(200).json({ modules });
                return;
            }
            const completedIds = new Set(patient.education_progresses.map((p) => p.module_id));
            const pregnancy = patient.pregnancies[0] || null;
            const riskTier = patient.risk_assessments[0]?.tier || 'LOW';
            // 2. Compute active gestational age
            const egaWeeks = pregnancy?.lmp_date
                ? (0, ega_calculator_1.calculateEGAWeeks)(new Date(pregnancy.lmp_date))
                : null;
            // Map completed status & personalize modules list
            const mappedModules = modules.map((mod) => {
                const isCompleted = completedIds.has(mod.id);
                const isTargetWeek = egaWeeks !== null && mod.week_number === egaWeeks;
                return {
                    ...mod,
                    is_completed: isCompleted,
                    is_current_recommendation: isTargetWeek,
                    is_safety_warning: riskTier !== 'LOW' && mod.week_number === 28, // Pinned safety module
                };
            });
            // 3. Extract specific active recommendations
            const currentRecommendation = mappedModules.find((m) => m.is_current_recommendation) || null;
            const safetyRecommendations = mappedModules.filter((m) => m.is_safety_warning && !m.is_completed);
            // 4. Dynamic AI Custom Lesson (with Redis Caching & Graceful Fallback)
            let aiRecommendation = null;
            if (egaWeeks !== null && currentRecommendation) {
                const cacheKey = `patient:${patientId}:ai_lesson:${egaWeeks}`;
                try {
                    const cached = await redis_1.redis.get(cacheKey);
                    if (cached) {
                        aiRecommendation = JSON.parse(cached);
                    }
                    else {
                        // Generate dynamic lesson from OpenAI
                        const generated = await ai_1.aiService.generatePersonalizedLesson({
                            patientName: patient.name || 'Mama',
                            age: patient.age,
                            weekNumber: egaWeeks,
                            riskTier,
                        });
                        if (generated) {
                            aiRecommendation = {
                                id: currentRecommendation.id,
                                week_number: egaWeeks,
                                title: `Weekly Lesson: ${currentRecommendation.title}`,
                                summary: generated.summary,
                                transcript: generated.transcript,
                                video_url: currentRecommendation.video_url,
                                is_completed: currentRecommendation.is_completed,
                                is_ai_generated: true,
                            };
                            // Cache in Redis for 24 hours
                            await redis_1.redis.set(cacheKey, JSON.stringify(aiRecommendation), 'EX', 24 * 60 * 60);
                        }
                    }
                }
                catch (err) {
                    logger_1.logger.warn({ err }, 'Failed to handle AI personalized lesson caching, falling back');
                }
            }
            res.status(200).json({
                patient: {
                    name: patient.name,
                    current_ega_weeks: egaWeeks,
                    risk_tier: riskTier,
                },
                recommendations: {
                    weekly_target: aiRecommendation || currentRecommendation, // Use AI if active, fallback to database clinical content
                    safety_alerts: safetyRecommendations,
                },
                modules: mappedModules,
            });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /education/modules/:id
     * Single module detail.
     */
    async getModule(req, res, next) {
        try {
            const { id } = req.params;
            const module = await prisma_1.default.educationModule.findUnique({ where: { id } });
            if (!module) {
                throw new errors_1.NotFoundError('Education module not found');
            }
            res.status(200).json({ module });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * PATCH /education/progress
     * Mark an education module as completed for the patient.
     */
    async markProgress(req, res, next) {
        try {
            const patientId = req.user.id;
            const { module_id } = req.body;
            // Check module exists
            const module = await prisma_1.default.educationModule.findUnique({ where: { id: module_id } });
            if (!module) {
                throw new errors_1.NotFoundError('Education module not found');
            }
            // Check if already completed
            const existing = await prisma_1.default.educationProgress.findFirst({
                where: { patient_id: patientId, module_id },
            });
            if (existing) {
                res.status(200).json({ message: 'Already completed', progress: existing });
                return;
            }
            const progress = await prisma_1.default.educationProgress.create({
                data: {
                    patient_id: patientId,
                    module_id,
                },
            });
            res.status(201).json({ progress });
        }
        catch (err) {
            next(err);
        }
    },
};
