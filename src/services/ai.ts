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

    if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'your_groq_api_key_here' || env.GROQ_API_KEY === '') {
      logger.info('Groq API Key is missing or default. Skipping AI personalization (graceful degradation).');
      return null;
    }

    try {
      logger.info({ patientName, weekNumber, languagePreference }, 'Requesting personalized AI antenatal lesson from Groq...');
      
      const roleStr = doctorRole ? `a ${doctorRole}` : 'an empathetic, clinical midwife';
      const langStr = languagePreference === 'pidgin' ? 'friendly, encouraging Nigerian Pidgin' : 'plain, reassuring English';

      const prompt = `You are ${roleStr} at the University of Benin Teaching Hospital (UBTH), Nigeria. 
Your patient is ${patientName}, age ${age}, in Week ${weekNumber} of pregnancy with a risk tier of ${riskTier}. 
Write a highly personalized, warm antenatal lesson for her current week of pregnancy entirely in ${langStr}.
Do NOT provide a translation in another language, just write the lesson strictly in ${langStr}.
Finally, on a new line, recommend a real, educational YouTube search link about "Pregnancy week ${weekNumber}" or a trusted channel like WHO/Mayo Clinic (e.g., https://www.youtube.com/results?search_query=pregnancy+week+${weekNumber}).
Address her directly by name ("${patientName}") and mention her current gestational week. Use common warm Nigerian pregnancy phrases.
Keep the total output under 250 words. Format with standard paragraphs.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
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
        throw new Error(`Groq API responded with status ${response.status}`);
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

  /**
   * Answers a question from a patient using their profile and medical context.
   */
  async answerPatientQuestion(patientData: any, question: string): Promise<string> {
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'your_groq_api_key_here' || env.GROQ_API_KEY === '') {
      return "I'm sorry, my AI features are currently unavailable.";
    }

    try {
      const prompt = `You are a helpful, compassionate medical AI assistant for 9Care at UBTH.
The patient asking the question is ${patientData.name || 'a patient'}.
Context:
- Age: ${patientData.age || 'Unknown'}
- Pregnancy info: ${JSON.stringify(patientData.pregnancies?.[0] || 'No current pregnancy info')}
- Risk Assessment: ${JSON.stringify(patientData.risk_assessments?.[0] || 'Unknown')}
- Recent symptoms: ${JSON.stringify(patientData.symptoms || 'None')}

Patient Question: "${question}"

Provide a deeply insightful, comforting, and medically sound response. Explain the "why" behind your advice so the patient truly understands what is happening in her body. Draw connections between her current gestational age, risk factors, and her symptoms. 
If the question implies an emergency, urgently advise her to seek immediate medical attention. Format your response with clear, easy-to-read paragraphs or bullet points where appropriate.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a warm, professional medical AI assistant at UBTH.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API responded with status ${response.status}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (err) {
      logger.error({ err }, 'Failed to answer patient question');
      return "I encountered an error trying to answer your question. Please try again later.";
    }
  },

  /**
   * Answers a medical question from a doctor, optionally incorporating specific patient context.
   */
  async answerDoctorQuestion(question: string, patientData?: any): Promise<string> {
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'your_groq_api_key_here' || env.GROQ_API_KEY === '') {
      return "AI features are currently unavailable.";
    }

    try {
      let prompt = `You are an expert medical AI assistant for doctors at UBTH.\n`;
      
      if (patientData) {
        prompt += `\nYou are answering a question in the context of the following patient:
- Name: ${patientData.name || 'Unknown'}
- Age: ${patientData.age || 'Unknown'}
- Pregnancy info: ${JSON.stringify(patientData.pregnancies?.[0] || 'No current pregnancy info')}
- Risk Assessment: ${JSON.stringify(patientData.risk_assessments?.[0] || 'Unknown')}
- Recent symptoms: ${JSON.stringify(patientData.symptoms || 'None')}\n`;
      }

      prompt += `\nDoctor's Question: "${question}"\n
Provide an exceptionally insightful, comprehensive, and highly accurate medical analysis. Break down complex pathophysiology, outline evidence-based differential diagnoses, and provide actionable, step-by-step clinical management recommendations tailored precisely to this patient's risk profile. Always cite relevant clinical guidelines (e.g., ACOG, WHO) and highlight any potential red flags or edge cases the doctor should be aware of. Structure your response with clear headings and bullet points.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are an advanced medical AI assistant designed to help healthcare providers.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API responded with status ${response.status}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (err) {
      logger.error({ err }, 'Failed to answer doctor question');
      return "I encountered an error trying to answer your question. Please try again later.";
    }
  }
};
