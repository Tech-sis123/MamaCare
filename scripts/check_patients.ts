import prisma from '../src/config/prisma';

async function main() {
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      name: true,
      phone_number: true,
      created_at: true,
      intake_status: true,
    },
    orderBy: { created_at: 'desc' },
  });

  console.log(`Total patients found: ${patients.length}`);
  console.log(JSON.stringify(patients, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
