"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const educationDispatcher_1 = require("../src/jobs/educationDispatcher");
const prisma_1 = __importDefault(require("../src/config/prisma"));
async function run() {
    console.log('🚀 Manually triggering the AI Education Dispatcher for testing...');
    await (0, educationDispatcher_1.dispatchWeeklyEducation)();
    console.log('✅ Dispatcher job complete.');
    await prisma_1.default.$disconnect();
    process.exit(0);
}
run();
