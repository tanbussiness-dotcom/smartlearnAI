
'use server';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;

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

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message: string;
  };
};

/**
 * A utility function to introduce a delay.
 * @param ms - The number of milliseconds to wait.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A cached function to generate content with the Gemini API with retry and model fallback logic.
 * It uses a simple in-memory cache to avoid repeated API calls for the same prompt.
 * It also includes a throttling mechanism to prevent API overload.
 *
 * @param prompt - The prompt to send to the model.
 * @param useCache - Whether to use the cache. Defaults to true.
 * @returns The generated text from the model.
 * @throws An error if the API call fails after all retries and fallbacks.
 */
export async function generateWithGemini(prompt: string, useCache = true): Promise<string> {
  if (!GEMINI_API_KEY) {
      const warning = "⚠️ Gemini API key is missing. Please add GOOGLE_API_KEY to environment variables.";
      console.warn(warning);
      throw new Error(warning);
  }

  if (useCache && cache.has(prompt)) {
    return cache.get(prompt)!;
  }

  // --- Throttling Logic ---
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > THROTTLE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  
  if (requestTimestamps.length >= THROTTLE_LIMIT) {
    console.log(`[Gemini Throttle] Waiting ${THROTTLE_DELAY_MS}ms to prevent overload.`);
    await delay(THROTTLE_DELAY_MS);
  }
  requestTimestamps.push(Date.now());
  // --- End Throttling Logic ---

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MODEL_FALLBACK_ORDER.length; attempt++) {
    const currentModel = MODEL_FALLBACK_ORDER[attempt];
    console.log(`[Gemini Model] Using: ${currentModel} (Attempt ${attempt + 1}/${MODEL_FALLBACK_ORDER.length})`);
    
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              topK: 1,
              topP: 1,
              maxOutputTokens: 8192,
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
          }),
        }
      );

      if ([429, 503].includes(res.status)) {
        lastError = new Error(`API returned status ${res.status}`);
        if (attempt < MODEL_FALLBACK_ORDER.length - 1) {
            const nextModel = MODEL_FALLBACK_ORDER[attempt + 1];
            console.warn(`[Gemini Switch] Switching model ${currentModel} → ${nextModel} due to ${res.status}.`);
        }
        continue; // Move to the next model in the fallback list
      }
      
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini API request failed with status ${res.status}: ${errorBody}`);
      }

      const data: GeminiResponse = await res.json();

      if (data.error) {
        throw new Error(`Gemini API Error: ${data.error.message}`);
      }
      
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (data.candidates?.[0]?.finishReason === 'SAFETY') {
          console.warn(`[Gemini Safety] Request for model ${currentModel} was blocked due to safety settings.`);
          lastError = new Error('Content generation was blocked by safety filters.');
          // Fallback to the next model if safety is the issue
          continue;
      }

      if (text) {
        if (useCache) {
          cache.set(prompt, text);
        }
        console.log(`✅ Success with model: ${currentModel}`);
        return text;
      }
      
      lastError = new Error("Gemini API returned an empty text response.");

    } catch (error: any) {
      lastError = error;
      if (attempt < MODEL_FALLBACK_ORDER.length - 1) {
        console.warn(`[Gemini Error] Attempt ${attempt + 1} with model ${currentModel} failed: ${error.message}. Switching to next model.`);
      }
    }
  }
  
  throw new Error(`All Gemini models failed due to overload or quota exhaustion. Last error: ${lastError?.message}`);
}
