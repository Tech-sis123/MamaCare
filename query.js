const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const patients = await prisma.patient.findMany({
    include: {
      intake_responses: true
    }
  });
  console.log(JSON.stringify(patients.map(p => ({ id: p.id, name: p.name, responsesCount: p.intake_responses.length })), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
