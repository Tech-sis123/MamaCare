"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbac = void 0;
const errors_1 = require("../utils/errors");
const rbac = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new errors_1.UnauthorizedError('Authentication required');
        }
        const userRole = req.user.role;
        // department_head inherits doctor permissions
        const effectiveRoles = [userRole];
        if (userRole === 'department_head') {
            effectiveRoles.push('doctor');
        }
        const hasAccess = allowedRoles.some((role) => effectiveRoles.includes(role));
        if (!hasAccess) {
            throw new errors_1.ForbiddenError('Insufficient permissions');
        }
        next();
    };
};
exports.rbac = rbac;
