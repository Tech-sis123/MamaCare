"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.symptomTimelineRouter = void 0;
const express_1 = require("express");
const controller_1 = require("./controller");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const schemas_1 = require("./schemas");
const router = (0, express_1.Router)();
// POST /symptoms — log symptoms, fires danger detection
router.post('/', auth_1.authenticate, (0, rbac_1.rbac)('patient'), (0, validate_1.validate)(schemas_1.symptomInputSchema), controller_1.symptomsController.logSymptoms);
// GET /patients/:id/symptoms?range=30d — symptom timeline
// Note: This route is mounted separately on the patients router
exports.symptomTimelineRouter = (0, express_1.Router)();
exports.symptomTimelineRouter.get('/:id/symptoms', auth_1.authenticate, (0, rbac_1.rbac)('patient', 'doctor', 'department_head'), (0, validate_1.validate)(schemas_1.patientIdParamSchema, 'params'), (0, validate_1.validate)(schemas_1.symptomTimelineQuerySchema, 'query'), controller_1.symptomsController.getSymptomTimeline);
exports.default = router;
