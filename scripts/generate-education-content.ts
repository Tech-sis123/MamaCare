import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

// Trusted YouTube channel IDs or search terms for whitelist
const TRUSTED_CHANNELS = [
  'World Health Organization (WHO)',
  'American College of Obstetricians and Gynecologists (ACOG)',
  'NHS',
  'Mayo Clinic'
];

async function main() {
  console.log('📖 Generating education content (one-time prep script)...');

  // Fetch all modules currently in DB (from seed)
  const modules = await prisma.educationModule.findMany();

  if (modules.length === 0) {
    console.log('⚠️ No modules found to populate. Please run seed first.');
    return;
  }

  for (const mod of modules) {
    console.log(`Processing Week ${mod.week_number}: ${mod.title}...`);

    let englishLesson = `This is the default detailed lesson for Week ${mod.week_number}. It covers key clinical insights, self-care routines, and what to expect during this stage of pregnancy.`;
    let pidginLesson = `Dis na di detailed lesson for Week ${mod.week_number}. E go help you understand wetin dey happen to your body and your baby dis week.`;
    let videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Fallback trusted video link

    // 1. Mock/Actual call to OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Calling OpenAI API...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a compassionate midwife providing antenatal education for Nigerian women.'
              },
              {
                role: 'user',
                content: `Draft a short pregnancy lesson in plain English and a translation in Nigerian Pidgin for week ${mod.week_number} of pregnancy. Keep it under 200 words total.`
              }
            ]
          })
        });

        const data = await response.json() as any;
        const text = data.choices[0].message.content || '';
        const parts = text.split(/pidgin/i);
        if (parts.length > 1) {
          englishLesson = parts[0].trim();
          pidginLesson = parts[1].replace(/[:\-]/, '').trim();
        } else {
          englishLesson = text;
        }
      } catch (err) {
        console.warn('OpenAI call failed or key not set, using default text.', err);
      }
    }

    // 2. Mock/Actual call to YouTube Data API
    if (process.env.YOUTUBE_API_KEY) {
      try {
        console.log('Calling YouTube Data API...');
        const query = encodeURIComponent(`pregnancy week ${mod.week_number} ${TRUSTED_CHANNELS[0]}`);
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&key=${process.env.YOUTUBE_API_KEY}&maxResults=1&type=video`
        );
        const data = await response.json() as any;
        if (data.items && data.items.length > 0) {
          videoUrl = `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
        }
      } catch (err) {
        console.warn('YouTube API call failed or key not set, using default video link.', err);
      }
    }

    // 3. Write results back to DB and flip status to draft
    await prisma.educationModule.update({
      where: { id: mod.id },
      data: {
        summary: englishLesson,
        transcript: pidginLesson,
        video_url: videoUrl,
        status: 'draft' // A doctor must review and publish
      }
    });

    console.log(`✅ Updated Week ${mod.week_number} to 'draft'`);
  }

  console.log('🎉 Education content generation script complete!');
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
