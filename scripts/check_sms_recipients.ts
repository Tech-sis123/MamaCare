import prisma from '../src/config/prisma';
import { isSmsPhone } from '../src/utils/contact';

async function run() {
  const patients = await prisma.patient.findMany({
    select: { id: true, name: true, phone_number: true, intake_status: true }
  });
  const valid = patients.filter((p) => isSmsPhone(p.phone_number));
  console.log(`Total patients in DB: ${patients.length}`);
  console.log(`Valid SMS recipients: ${valid.length}`);
  console.log(JSON.stringify(valid, null, 2));
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
