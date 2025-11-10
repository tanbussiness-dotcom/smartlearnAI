
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
const THROTTLE_LIMIT = 2; // Max requests
const THROTTLE_WINDOW_MS = 1000; // per 1 second
const THROTTLE_DELAY_MS = 2000; // Wait 2 seconds if throttled

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
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
 * Returns a random integer between min and max (inclusive).
 */
const getRandomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};


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
    throw new Error("GOOGLE_API_KEY is not set in the environment variables.");
  }

  if (useCache && cache.has(prompt)) {
    return cache.get(prompt)!;
  }

  // --- Throttling Logic ---
  const now = Date.now();
  // Clean up old timestamps
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > THROTTLE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  
  if (requestTimestamps.length >= THROTTLE_LIMIT) {
    console.log(`[Gemini Throttle] Waiting ${THROTTLE_DELAY_MS}ms to avoid overload.`);
    await delay(THROTTLE_DELAY_MS);
  }

  requestTimestamps.push(Date.now());
  // --- End Throttling Logic ---

  let lastError: Error | null = null;
  const maxRetries = MODEL_FALLBACK_ORDER.length;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentModel = MODEL_FALLBACK_ORDER[attempt];
    console.log(`[Gemini Attempt ${attempt + 1}/${maxRetries}] Calling model: ${currentModel}`);
    
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              // Add safety settings to reduce blocking
              // This is a trade-off, adjust as needed.
              // "BLOCK_NONE" is very permissive.
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              ],
            },
          }),
        }
      );

      // Retry on 429 (Too Many Requests), 500 (Internal Server Error), or 503 (Service Unavailable)
      if ([429, 500, 503].includes(res.status)) {
        lastError = new Error(`Gemini API request failed with status ${res.status}: ${await res.text()}`);
        if (attempt < maxRetries - 1) {
            const nextModel = MODEL_FALLBACK_ORDER[attempt + 1];
            console.warn(`[Gemini Fallback] Switching model from ${currentModel} → ${nextModel} due to status ${res.status}.`);
            // Optional: add a small delay before falling back to the next model
            await delay(500); 
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

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (text) {
        if (useCache) {
          cache.set(prompt, text);
        }
        console.log(`✅ Success with model: ${currentModel}`);
        return text; // Success
      }
      
      // If we get here, the response was successful but empty. We'll let it fall through to retry with the next model.
      lastError = new Error("Gemini API returned an empty text response.");

    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        console.warn(`[Gemini Attempt ${attempt + 1}] An error occurred with model ${currentModel}: ${error.message}. Falling back...`);
      }
    }
  }
  
  // If the loop finishes without returning, it means all retries and fallbacks failed.
  throw new Error(`All Gemini models unavailable after fallback sequence. Last error: ${lastError?.message}`);
}
