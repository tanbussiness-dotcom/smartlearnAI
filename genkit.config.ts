
import { genkit } from 'genkit';
import { vertexAI } from '@google-cloud/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
