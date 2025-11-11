
'use server';

import { parseGeminiJson } from '@/lib/utils';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
// Updated to models compatible with the 'generativelanguage' endpoint and API Key authentication.
const MODELS = [
  process.env.AI_MODEL_ID || "gemini-1.5-flash", // Primary model, fast and cost-effective, supports API Key.
  "gemini-pro" // Stable fallback, also supports API Key.
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
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
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
      console.error(`[Gemini API] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
  }

  const cacheKey = `${prompt}-${MODELS.join('-')}`;
  if (useCache && cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
  }

  let aiText = "";
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      console.log(`[Gemini API] 🔹 Trying model: ${model}`);
      aiText = await callGeminiModel(prompt, model);
      if (aiText) {
          console.log(`[Gemini API] ✅ Success with ${model}.`);
          break; // Exit loop on success
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API] ⚠️ Model ${model} failed: ${err.message}. Trying next model...`);
      aiText = ""; // Reset aiText on failure
    }
  }

  if (!aiText) {
      const finalError = `All Gemini models failed. Last error: ${lastError?.message || "Unknown error"}`;
      console.error(`[Gemini API] ❌ ${finalError}`);
      throw new Error(finalError);
  }

  // 1️⃣ Validate parse result
  let parsedResult;
  let parsedOK = true;
  try {
    parsedResult = parseGeminiJson<any>(aiText);
    if (!parsedResult || Object.keys(parsedResult).length === 0) {
      parsedOK = false;
    }
  } catch {
    parsedOK = false;
  }

  // 2️⃣ Retry if invalid JSON
  if (!parsedOK) {
    console.warn("[Gemini Retry] ⚠️ Invalid JSON detected, retrying with strict prompt...");
    const strictPrompt = `
      You previously failed to output valid JSON.
      Your task is to respond with only pure, valid JSON, without any markdown, explanations, or extra text.
      This is the original request:
      ---
      ${prompt}
      ---
      
      ⚠️ IMPORTANT: Your entire output must be a single JSON object, starting with { and ending with }.
    `;

    try {
      // Use the last, most stable model for the retry attempt.
      const retryText = await callGeminiModel(strictPrompt, MODELS[MODELS.length-1]); 
      const retryResult = parseGeminiJson<any>(retryText);
      
      if (retryResult && Object.keys(retryResult).length > 0) {
        console.log("[Gemini Retry] ✅ Success after repair attempt");
        if (useCache) cache.set(cacheKey, retryText);
        return retryText; // Return the successfully repaired text
      }
      
      console.warn("[Gemini Retry] ❌ Retry attempt also resulted in invalid or empty JSON.");
    } catch (retryErr: any) {
      console.error("[Gemini Retry] ❌ Retry attempt failed entirely:", retryErr.message);
    }
  }

  // 3️⃣ Cache original successful text if it was valid JSON from the start
  if (parsedOK && useCache) {
      cache.set(cacheKey, aiText);
  }
  
  return aiText;
}
