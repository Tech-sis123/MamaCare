"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const router = (0, express_1.Router)();
// SSE subscribe — doctor-only
router.get('/subscribe', auth_1.authenticate, (0, rbac_1.rbac)('doctor', 'department_head'), controller_1.alertsController.subscribe);
// Acknowledge an alert
router.post('/:id/acknowledge', auth_1.authenticate, (0, rbac_1.rbac)('doctor', 'department_head'), controller_1.alertsController.acknowledge);
exports.default = router;
