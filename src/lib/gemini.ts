
'use server';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.AI_MODEL_ID || "gemini-pro"; // Fallback model
const cache = new Map<string, string>();

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
 * A cached function to generate content with the Gemini API with retry logic.
 * It uses a simple in-memory cache to avoid repeated API calls for the same prompt.
 *
 * @param prompt - The prompt to send to the model.
 * @param useCache - Whether to use the cache. Defaults to true.
 * @returns The generated text from the model.
 * @throws An error if the API call fails after all retries.
 */
export async function generateWithGemini(prompt: string, useCache = true): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set in the environment variables.");
  }

  if (useCache && cache.has(prompt)) {
    return cache.get(prompt)!;
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        }
      );

      // Retry on 429 (Too Many Requests), 500 (Internal Server Error), or 503 (Service Unavailable)
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        lastError = new Error(`Gemini API request failed with status ${res.status}`);
        if (attempt < maxRetries) {
          const delayTime = 1000 * attempt;
          console.warn(`[Gemini Retry ${attempt}] API returned status ${res.status}. Retrying in ${delayTime}ms...`);
          await delay(delayTime);
          continue; // Go to the next iteration
        }
        // If it's the last attempt, fall through to throw the error
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

      // Retry if the response text is empty
      if (!text) {
        lastError = new Error("Gemini API returned an empty text response.");
        if (attempt < maxRetries) {
            const delayTime = 1000 * attempt;
            console.warn(`[Gemini Retry ${attempt}] Received empty response. Retrying in ${delayTime}ms...`);
            await delay(delayTime);
            continue;
        }
      }

      if (text) {
        if (useCache) {
          cache.set(prompt, text);
        }
        return text; // Success
      }

    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const delayTime = 1000 * attempt;
        console.warn(`[Gemini Retry ${attempt}] An error occurred: ${error.message}. Retrying in ${delayTime}ms...`);
        await delay(delayTime);
      }
    }
  }
  
  // If the loop finishes without returning, it means all retries failed.
  throw new Error(`Gemini API Unavailable after ${maxRetries} retries. Last error: ${lastError?.message}`);
}
