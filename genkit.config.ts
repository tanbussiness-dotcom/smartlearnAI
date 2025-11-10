import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'smartlearn-ai',
      location: 'us-central1',
      keyFile: './vertex-ai-admin.json',
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
