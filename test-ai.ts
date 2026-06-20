import { env } from './src/config/env';

async function run() {
  console.log('Testing Groq directly...');
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are an advanced medical AI assistant.' },
          { role: 'user', content: 'What are the critical danger signs of preeclampsia?' }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq Error Body:', errorText);
      return;
    }

    const data = await response.json() as any;
    console.log('\n--- AI RESPONSE ---');
    console.log(data.choices?.[0]?.message?.content);
    console.log('-------------------\n');
    console.log('Success!');
  } catch (err) {
    console.error('Error testing Groq AI:', err);
  }
}

run();
