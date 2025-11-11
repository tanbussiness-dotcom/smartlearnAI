
'use server';

import { ai } from '@/ai/genkit';
import { GenerateRequest } from '@genkit-ai/google-genai';

// Fallback model order. Starts with the most preferred model.
const MODEL_FALLBACK_ORDER = [
  process.env.AI_MODEL_ID || "gemini-1.5-flash",
  "gemini-pro"
];

const cache = new Map<string, string>();

// --- Throttling variables ---
const requestTimestamps: number[] = [];
const THROTTLE_LIMIT = 3; // Max requests
const THROTTLE_WINDOW_MS = 1000; // per 1 second
const THROTTLE_DELAY_MS = 2000; // Wait 2 seconds if throttled

/**
 * A utility function to introduce a delay with jitter.
 * @param minMs - The minimum number of milliseconds to wait.
 * @param maxMs - The maximum number of milliseconds to wait.
 */
const delay = (minMs: number, maxMs: number) => {
    const jitter = Math.random() * (maxMs - minMs);
    const totalDelay = minMs + jitter;
    return new Promise(resolve => setTimeout(resolve, totalDelay));
};

/**
 * A cached function to generate content with the Gemini API with retry and model fallback logic.
 *
 * @param prompt - The prompt to send to the model.
 * @param useCache - Whether to use the cache. Defaults to true.
 * @returns The generated text from the model.
 * @throws An error if the API call fails after all fallbacks and retries.
 */
export async function generateWithGemini(prompt: string, useCache = true): Promise<string> {
  if (!process.env.GOOGLE_API_KEY) {
      const warning = "⚠️ Gemini API key is missing. Please add GOOGLE_API_KEY to environment variables.";
      console.warn(warning);
      throw new Error(warning);
  }

  const cacheKey = `${prompt}-${MODEL_FALLBACK_ORDER.join('-')}`;
  if (useCache && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // --- Throttling Logic ---
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > THROTTLE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  
  if (requestTimestamps.length >= THROTTLE_LIMIT) {
    console.log(`[Gemini Throttle] Waiting ${THROTTLE_DELAY_MS}ms to prevent overload.`);
    await delay(THROTTLE_DELAY_MS, THROTTLE_DELAY_MS);
  }
  requestTimestamps.push(Date.now());
  // --- End Throttling Logic ---

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let modelIndex = 0; modelIndex < MODEL_FALLBACK_ORDER.length; modelIndex++) {
    const currentModel = MODEL_FALLBACK_ORDER[modelIndex];
    console.log(`[Gemini Model] Using: ${currentModel} (Attempt ${modelIndex + 1}/${MODEL_FALLBACK_ORDER.length})`);
    
    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
            const request: GenerateRequest = {
                model: `googleai/${currentModel}`,
                prompt: prompt,
                config: {
                    temperature: 0.7,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 8192,
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    ],
                },
            };

            const startTime = Date.now();
            const response = await ai.generate(request);
            const endTime = Date.now();
            const text = response.text;

            if (response.finishReason === 'SAFETY') {
                lastError = new Error('Content generation was blocked by safety filters.');
                console.warn(`[Gemini Safety] Request for model ${currentModel} blocked.`);
                break; // Break retry loop and move to the next model
            }
            
            if (text) {
                if (useCache) {
                  cache.set(cacheKey, text);
                }
                console.log(`✅ Success (model: ${currentModel}, time: ${endTime - startTime}ms)`);
                return text;
            }
            
            lastError = new Error("Gemini API returned an empty text response.");

        } catch (error: any) {
            lastError = error;
            // Check for status codes that warrant a retry or fallback
            if (error.status === 429 || error.status === 503) {
                 if (retryCount < maxRetries - 1) {
                    const delayRanges = [[1000, 2000], [3000, 5000], [6000, 10000]];
                    const [min, max] = delayRanges[retryCount];
                    const waitTime = min + Math.random() * (max - min);
                    console.warn(`[Gemini Retry ${retryCount + 1}] ${error.status} - retrying in ${Math.round(waitTime)}ms`);
                    await delay(min, max);
                    continue; // Continue to next retry
                }
            }
            // For other errors (like 404) or if retries are exhausted, break to fallback
            break; 
        }
    }
    
    // If we've exhausted retries for a model, and it's not the last model, log fallback
    if (modelIndex < MODEL_FALLBACK_ORDER.length - 1) {
        console.warn(`[Gemini Fallback] Switching model from ${currentModel} → ${MODEL_FALLBACK_ORDER[modelIndex + 1]} due to persistent error.`);
    }
  }
  
  throw new Error(`All Gemini models failed due to overload or quota exhaustion. Last error: ${lastError?.message}`);
}
