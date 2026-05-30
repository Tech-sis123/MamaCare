"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestRiskParamsSchema = exports.runRiskSchema = void 0;
const zod_1 = require("zod");
exports.runRiskSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('Invalid patient ID'),
});
exports.latestRiskParamsSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('Invalid patient ID'),
});
