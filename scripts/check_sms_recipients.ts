import prisma from '../src/config/prisma';
import { isSmsPhone, formatPhoneForTermii } from '../src/utils/contact';

async function run() {
  const allPatients = await prisma.patient.findMany({
    select: { id: true, name: true, phone_number: true, intake_status: true },
    orderBy: { created_at: 'desc' },
  });

  const validPatients = allPatients.filter((p) => isSmsPhone(p.phone_number));

  const uniqueMap = new Map<string, { name: string | null; raw: string; formatted: string }>();

  for (const p of validPatients) {
    if (!p.phone_number) continue;
    const formatted = formatPhoneForTermii(p.phone_number);
    if (!uniqueMap.has(formatted)) {
      uniqueMap.set(formatted, {
        name: p.name,
        raw: p.phone_number,
        formatted,
      });
    }
  }

  const list = Array.from(uniqueMap.values());

  console.log(`Total Unique Valid Phone Numbers: ${list.length}`);
  console.log('--- Numbers List ---');
  list.forEach((item, index) => {
    console.log(`${index + 1}. ${item.formatted} (Raw: ${item.raw}) - Patient: ${item.name || 'Anonymous'}`);
  });

  console.log('\n--- Phone Numbers Only (Array) ---');
  console.log(JSON.stringify(list.map(l => l.formatted), null, 2));

  console.log('\n--- Raw Phone Numbers from DB (Array) ---');
  console.log(JSON.stringify(list.map(l => l.raw), null, 2));
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
