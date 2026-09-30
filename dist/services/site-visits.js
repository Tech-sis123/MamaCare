"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPatientSiteVisit = recordPatientSiteVisit;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = require("../utils/logger");
/**
 * Record a patient opening the app.
 * Counts at most one visit per calendar day (UTC) so refreshes don't inflate conversion.
 */
async function recordPatientSiteVisit(patientId, path = '/dashboard') {
    try {
        const now = new Date();
        const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const existingToday = await prisma_1.default.patientSiteVisit.findFirst({
            where: { patient_id: patientId, visited_at: { gte: dayStart } },
            select: { id: true },
        });
        if (existingToday) {
            await prisma_1.default.patient.update({
                where: { id: patientId },
                data: { last_seen_at: now },
            });
            return;
        }
        await prisma_1.default.$transaction([
            prisma_1.default.patientSiteVisit.create({
                data: { patient_id: patientId, visited_at: now, path },
            }),
            prisma_1.default.patient.update({
                where: { id: patientId },
                data: { last_seen_at: now, site_visit_count: { increment: 1 } },
            }),
        ]);
    }
    catch (err) {
        logger_1.logger.warn({ err, patientId }, 'Failed to record patient site visit');
    }
}
