import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      projectId: 'smartlearn-ai',
      location: 'us-central1',
      keyFile: './vertex-ai-admin.json',
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
