import prisma from '../src/config/prisma';
import { termiiService } from '../src/services/termii';
import { isSmsPhone, formatPhoneForTermii } from '../src/utils/contact';

const MESSAGE = `There is an update waiting for you on 9Care!

We have just added a new educational update to help you better understand your pregnancy and make decisions.

Log into your account and take a look:
www.9careai.com/education

Stay informed. Stay prepared.`;

async function main() {
  console.log('--- Starting 9Care Educational Update SMS Broadcast (Clean GSM) ---');
  console.log('Message:');
  console.log(MESSAGE);
  console.log('----------------------------------------------------');

  const allPatients = await prisma.patient.findMany({
    select: {
      id: true,
      name: true,
      phone_number: true,
      intake_status: true,
    },
    orderBy: { created_at: 'desc' },
  });

  console.log(`Found ${allPatients.length} total patient records in database.`);

  // Filter valid phone numbers
  const validPatients = allPatients.filter((p) => isSmsPhone(p.phone_number));
  console.log(`Found ${validPatients.length} patients with valid phone numbers.`);

  // Deduplicate by formatted phone number
  const uniqueRecipients = new Map<
    string,
    { id: string; name: string | null; phone: string; formatted: string }
  >();

  for (const p of validPatients) {
    if (!p.phone_number) continue;
    const formatted = formatPhoneForTermii(p.phone_number);
    if (!uniqueRecipients.has(formatted)) {
      uniqueRecipients.set(formatted, {
        id: p.id,
        name: p.name,
        phone: p.phone_number,
        formatted,
      });
    }
  }

  const recipients = Array.from(uniqueRecipients.values());
  console.log(`Unique recipient phone numbers to send to: ${recipients.length}`);

  let successCount = 0;
  let failCount = 0;
  const results: Array<{ phone: string; name: string | null; status: string; messageId?: string; error?: string }> = [];

  for (const recipient of recipients) {
    try {
      console.log(`Sending to ${recipient.name || 'Patient'} (${recipient.formatted})...`);
      const res = await termiiService.sendSMS({
        to: recipient.formatted,
        sms: MESSAGE,
        type: 'plain',
      });
      console.log(`  ✓ Sent! Message ID: ${res.message_id}`);
      successCount++;
      results.push({
        phone: recipient.formatted,
        name: recipient.name,
        status: 'sent',
        messageId: res.message_id,
      });
    } catch (err: any) {
      console.error(`  ✗ Failed for ${recipient.formatted}:`, err.message || err);
      failCount++;
      results.push({
        phone: recipient.formatted,
        name: recipient.name,
        status: 'failed',
        error: err.message || String(err),
      });
    }

    // Small delay between sends to be gentle on rate limits
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  console.log('\n--- Broadcast Summary ---');
  console.log(`Total attempted: ${recipients.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error('Fatal broadcast error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
