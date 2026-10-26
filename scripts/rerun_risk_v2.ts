/**
 * One-off: re-grade every patient with risk engine v2 (clinical high-risk guideline).
 *
 *   npx tsx scripts/rerun_risk_v2.ts           # dry run: shows tier changes, writes nothing
 *   npx tsx scripts/rerun_risk_v2.ts --apply   # saves a new assessment for each patient
 *
 * Run only after manual_pregnancy_risk_factors.sql has been applied and the v2 backend is deployed.
 */
import prisma from '../src/config/prisma';
import { buildRiskInput } from '../src/modules/risk/inputs';
import { runRiskEngine } from '../src/modules/risk/engine';
import { assessPatientRisk } from '../src/modules/risk/assess';

const apply = process.argv.includes('--apply');

async function run() {
  const patients = await prisma.patient.findMany({
    include: {
      pregnancies: { orderBy: { id: 'desc' }, take: 1 },
      intake_responses: true,
      risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  });

  const changes: Record<string, number> = {};
  for (const p of patients) {
    const before = p.risk_assessments[0]?.tier ?? 'NONE';
    const after = runRiskEngine(buildRiskInput(p, p.pregnancies[0] || null, p.intake_responses)).tier;
    const key = `${before} → ${after}`;
    changes[key] = (changes[key] || 0) + 1;
    if (apply) await assessPatientRisk(p.id, { type: 'system', id: 'risk_engine_v2_backfill' });
  }

  console.log(`${patients.length} patients ${apply ? 're-graded' : '(dry run, nothing saved)'}`);
  for (const [key, n] of Object.entries(changes).sort()) console.log(`  ${key}: ${n}`);
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
