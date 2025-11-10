
import { genkit, configureGenkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI({ location: 'us-central1' }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
