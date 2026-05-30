"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const schemas_1 = require("./schemas");
const schemas_2 = require("../symptoms/schemas");
const router = (0, express_1.Router)();
// Doctor queue
router.get('/queue', auth_1.authenticate, (0, rbac_1.rbac)('doctor', 'department_head'), (0, validate_1.validate)(schemas_1.queueQuerySchema, 'query'), controller_1.providersController.getQueue);
// Patient summary (mounted here but uses patient ID)
router.get('/patients/:id/summary', auth_1.authenticate, (0, rbac_1.rbac)('doctor', 'department_head'), (0, validate_1.validate)(schemas_2.patientIdParamSchema, 'params'), controller_1.providersController.getPatientSummary);
// Visit notes
router.post('/visits/:id/notes', auth_1.authenticate, (0, rbac_1.rbac)('doctor', 'department_head'), (0, validate_1.validate)(schemas_1.visitIdParamSchema, 'params'), (0, validate_1.validate)(schemas_1.visitNotesSchema), controller_1.providersController.createVisitNotes);
exports.default = router;
