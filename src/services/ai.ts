import { env } from '../config/env';
import { logger } from '../utils/logger';

interface GenerateLessonParams {
  patientName: string;
  age: number;
  weekNumber: number;
  riskTier: string;
  doctorRole?: string;
  languagePreference?: string | null;
}

export const aiService = {
  /**
   * Generates a dynamic, highly-personalized clinical antenatal lesson using OpenAI.
   * Gracefully returns null if OpenAI key is missing or API errors.
   */
  async generatePersonalizedLesson(params: GenerateLessonParams): Promise<{ summary: string; transcript: string } | null> {
    const { patientName, age, weekNumber, riskTier, doctorRole, languagePreference } = params;

    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'your_openai_api_key_here' || env.OPENAI_API_KEY === '') {
      logger.info('OpenAI API Key is missing or default. Skipping AI personalization (graceful degradation).');
      return null;
    }

    try {
      logger.info({ patientName, weekNumber, languagePreference }, 'Requesting personalized AI antenatal lesson from OpenAI...');
      
      const roleStr = doctorRole ? `a ${doctorRole}` : 'an empathetic, clinical midwife';
      const langStr = languagePreference === 'pidgin' ? 'friendly, encouraging Nigerian Pidgin' : 'plain, reassuring English';

      const prompt = `You are ${roleStr} at the University of Benin Teaching Hospital (UBTH), Nigeria. 
Your patient is ${patientName}, age ${age}, in Week ${weekNumber} of pregnancy with a risk tier of ${riskTier}. 
Write a highly personalized, warm antenatal lesson for her current week of pregnancy entirely in ${langStr}.
Do NOT provide a translation in another language, just write the lesson strictly in ${langStr}.
Finally, on a new line, recommend a real, educational YouTube search link about "Pregnancy week ${weekNumber}" or a trusted channel like WHO/Mayo Clinic (e.g., https://www.youtube.com/results?search_query=pregnancy+week+${weekNumber}).
Address her directly by name ("${patientName}") and mention her current gestational week. Use common warm Nigerian pregnancy phrases.
Keep the total output under 250 words. Format with standard paragraphs.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a warm, professional, compassionate clinical antenatal advisor at UBTH, Nigeria.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API responded with status ${response.status}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content || '';

      if (!text) {
        return null;
      }

      return {
        summary: text.trim(),
        transcript: '',
      };
    } catch (err) {
      logger.error({ err }, 'Failed to generate personalized AI lesson');
      return null;
    }
  },
};
