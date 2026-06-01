import { dispatchWeeklyEducation } from '../src/jobs/educationDispatcher';
import prisma from '../src/config/prisma';

async function run() {
  console.log('🚀 Manually triggering the AI Education Dispatcher for testing...');
  await dispatchWeeklyEducation();
  console.log('✅ Dispatcher job complete.');
  await prisma.$disconnect();
  process.exit(0);
}

run();
