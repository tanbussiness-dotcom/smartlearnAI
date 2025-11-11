
'use server';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];
const cache = new Map<string, string>();

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message: string };
};


async function callGeminiModel(prompt: string, model: string): Promise<string> {
  if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_API_KEY is missing in environment variables.");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json", // Enforce JSON output
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${model} failed (${res.status}): ${errText}`);
  }

  const data: GeminiResponse = await res.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error(`Content generation blocked by safety filters for model ${model}.`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) {
      throw new Error(`Empty response from model ${model}.`);
  }
  
  return text;
}

export async function generateWithGemini(prompt: string, useCache = true): Promise<string> {
  if (!GEMINI_API_KEY) {
      const errorMsg = "GOOGLE_API_KEY is missing in environment variables.";
      throw new Error(errorMsg);
  }

  const cacheKey = `${prompt}-${MODELS[0]}`; // Cache based on primary model
  if (useCache && cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
  }

  let lastError: any = null;

  for (const model of MODELS) {
    try {
      const aiText = await callGeminiModel(prompt, model);
      if (aiText) {
        if (useCache) {
            cache.set(cacheKey, aiText);
        }
        return aiText; // Return on first success
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  // If all models failed, throw the last error
  const finalError = `All Gemini models failed. Last error: ${lastError?.message || "Unknown error"}`;
  throw new Error(finalError);
}



