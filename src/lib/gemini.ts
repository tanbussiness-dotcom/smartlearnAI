
'use server';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.AI_MODEL_ID || "gemini-pro";
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
 * A cached function to generate content with the Gemini API.
 * It uses a simple in-memory cache to avoid repeated API calls for the same prompt.
 * 
 * @param prompt - The prompt to send to the model.
 * @param useCache - Whether to use the cache. Defaults to true.
 * @returns The generated text from the model.
 * @throws An error if the API call fails or returns an error.
 */
export async function generateWithGemini(prompt: string, useCache = true): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set in the environment variables.");
  }

  if (useCache && cache.has(prompt)) {
    return cache.get(prompt)!;
  }

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

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini API request failed with status ${res.status}: ${errorBody}`);
  }

  const data: GeminiResponse = await res.json();

  if (data.error) {
    throw new Error(`Gemini API Error: ${data.error.message}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (useCache) {
    cache.set(prompt, text);
  }

  return text;
}
