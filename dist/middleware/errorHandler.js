"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    logger_1.logger.error(err);
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'validation_failed',
            issues: err.issues,
        });
    }
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;
    res.status(statusCode).json({
        error: message,
    });
};
exports.errorHandler = errorHandler;
