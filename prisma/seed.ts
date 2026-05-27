import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Seed Doctors ───────────────────────────────────────────
  const doctorPassword = await bcrypt.hash('mamacare123', 10);

  const doctor1 = await prisma.doctor.upsert({
    where: { email: 'dr.adaeze@ubth.ng' },
    update: {},
    create: {
      name: 'Dr. Adaeze Okonkwo',
      email: 'dr.adaeze@ubth.ng',
      password_hash: doctorPassword,
      role: 'doctor',
    },
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { email: 'dr.emeka@ubth.ng' },
    update: {},
    create: {
      name: 'Dr. Emeka Nwosu',
      email: 'dr.emeka@ubth.ng',
      password_hash: doctorPassword,
      role: 'doctor',
    },
  });

  const deptHead = await prisma.doctor.upsert({
    where: { email: 'dr.osagie@ubth.ng' },
    update: {},
    create: {
      name: 'Dr. Osagie Iyamu',
      email: 'dr.osagie@ubth.ng',
      password_hash: doctorPassword,
      role: 'department_head',
    },
  });

  console.log('✅ Doctors seeded');

  // ─── System Config (on-call doctor) ──────────────────────────
  const existingConfig = await prisma.systemConfig.findFirst();
  if (!existingConfig) {
    await prisma.systemConfig.create({
      data: {
        on_call_doctor_id: doctor1.id,
      },
    });
  }
  console.log('✅ System config seeded');

  // ─── Seed Sample Patient ────────────────────────────────────
  const patient = await prisma.patient.upsert({
    where: { phone_number: '+2348012345678' },
    update: {},
    create: {
      phone_number: '+2348012345678',
      name: 'Blessing Okafor',
      age: 28,
      education_level: 'tertiary',
      occupation: 'teacher',
      marital_status: 'married',
      address: 'Benin City, Edo State',
      religion: 'Christian',
      ethnicity: 'Bini',
      language_preference: 'en',
      primary_doctor_id: doctor1.id,
    },
  });

  // Create pregnancy for sample patient
  const lmpDate = new Date();
  lmpDate.setDate(lmpDate.getDate() - 84); // 12 weeks ago

  const edd = new Date(lmpDate);
  edd.setDate(edd.getDate() + 280);

  await prisma.pregnancy.create({
    data: {
      patient_id: patient.id,
      lmp_date: lmpDate,
      edd_computed: edd,
      current_ega_weeks: 12,
      booking_weight: 65,
      booking_height: 1.62,
      booking_bp_systolic: 110,
      booking_bp_diastolic: 70,
      blood_group: 'O+',
      genotype: 'AA',
      rvd_status: 'negative',
      vdrl: 'non-reactive',
      pcv: 33,
      hep_b: 'negative',
      tetanus_history: '2 doses',
      gravidity: 2,
      parity: 1,
    },
  });

  console.log('✅ Sample patient seeded');

  // ─── Seed 15 Education Modules ──────────────────────────────
  const educationModules = [
    { week: 6, title: 'Understanding Your First Trimester', summary: 'Learn about the early changes in your body and your developing baby during weeks 6-8.' },
    { week: 8, title: 'Nutrition During Pregnancy', summary: 'Essential nutrients, foods to eat, and foods to avoid during the first trimester.' },
    { week: 10, title: 'Managing Morning Sickness', summary: 'Tips and remedies for dealing with nausea and vomiting in early pregnancy.' },
    { week: 12, title: 'Your First Antenatal Visit', summary: 'What to expect at your booking visit and the tests you\'ll undergo.' },
    { week: 14, title: 'Welcome to the Second Trimester', summary: 'The second trimester brings new changes. Learn what to expect from weeks 14-16.' },
    { week: 16, title: 'Feeling Baby Move', summary: 'When to expect quickening and how to monitor fetal movements.' },
    { week: 18, title: 'Anomaly Scan Guide', summary: 'Understanding your mid-pregnancy ultrasound scan and what it checks for.' },
    { week: 20, title: 'Exercise During Pregnancy', summary: 'Safe exercises and activities to keep you healthy during pregnancy.' },
    { week: 24, title: 'Preparing for the Third Trimester', summary: 'What happens as your baby grows bigger and your body prepares for delivery.' },
    { week: 28, title: 'Danger Signs to Watch For', summary: 'Critical warning signs that require immediate medical attention.' },
    { week: 30, title: 'Birth Plan Preparation', summary: 'Creating your birth plan and understanding your delivery options.' },
    { week: 32, title: 'Breastfeeding Basics', summary: 'Preparing for breastfeeding: benefits, techniques, and common challenges.' },
    { week: 34, title: 'Preparing Your Hospital Bag', summary: 'What to pack for delivery day for you and your newborn.' },
    { week: 36, title: 'Labour Signs and Stages', summary: 'Recognizing true vs false labour and understanding the stages of delivery.' },
    { week: 38, title: 'Postpartum Care', summary: 'What to expect after delivery: recovery, newborn care, and family planning.' },
  ];

  for (const mod of educationModules) {
    await prisma.educationModule.create({
      data: {
        week_number: mod.week,
        title: mod.title,
        summary: mod.summary,
        video_url: null,
        audio_url: null,
        transcript: null,
        status: 'published',
      },
    });
  }

  console.log('✅ 15 education modules seeded');
  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
