
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({ client: 'vertex' }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
