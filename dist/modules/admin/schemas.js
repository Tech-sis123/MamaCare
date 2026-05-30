"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignDoctorSchema = void 0;
const zod_1 = require("zod");
exports.assignDoctorSchema = zod_1.z.object({
    doctor_id: zod_1.z.string().uuid(),
});
