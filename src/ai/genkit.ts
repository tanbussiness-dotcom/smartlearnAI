
'use server';
/**
 * @fileoverview This file initializes and configures the Genkit AI instance.
 * It sets up the necessary plugins, such as the Google AI plugin for Gemini,
 * and exports a singleton `ai` object to be used throughout the application
 * for all generative AI tasks.
 */
import { genkit, type GenkitError } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with the Google AI plugin.
// This allows the use of Google's generative models (e.g., Gemini)
// by providing the necessary authentication and endpoint configuration.
// The API key is automatically sourced from the GOOGLE_API_KEY environment variable.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // The default log level is 'info'. Set to 'debug' for more verbose output.
  logLevel: 'info',
  // This error handler is called for all uncaught exceptions in flows.
  // We can use it to log errors to a centralized service.
  // Note: This does not handle errors that are caught within a flow.
  flowStallTimeout: '60s' // Set a timeout for flows
});
