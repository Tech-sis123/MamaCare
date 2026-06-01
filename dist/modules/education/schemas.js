"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markProgressSchema = exports.moduleIdParamSchema = exports.educationModulesQuerySchema = void 0;
const zod_1 = require("zod");
exports.educationModulesQuerySchema = zod_1.z.object({
    week: zod_1.z.string().optional().transform((v) => v ? parseInt(v, 10) : undefined),
});
exports.moduleIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid module ID'),
});
exports.markProgressSchema = zod_1.z.object({
    module_id: zod_1.z.string().uuid('Invalid module ID'),
});
