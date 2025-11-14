
'use server';

import { firestoreAdmin } from '@/firebase/admin';
import { decrypt } from './crypto';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const MODELS = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
];
const cache = new Map<string, string>();

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message: string };
};


async function callGeminiModel(prompt: string, model: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
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

export async function generateWithGemini(prompt: string, useCache = true, userId?: string): Promise<string> {
  let activeApiKey = GEMINI_API_KEY;
  let cacheKey = `${prompt}-${MODELS[0]}`;

  if (userId) {
    try {
      const userDoc = await firestoreAdmin.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.geminiKey) {
          const decryptedKey = decrypt(userData.geminiKey);
          if (decryptedKey) {
            activeApiKey = decryptedKey;
            cacheKey = `${prompt}-${userId}`; // Use a user-specific cache key
          }
        }
      }
    } catch (error) {
      console.warn(`Could not retrieve user API key for user ${userId}. Falling back to system key.`, error);
    }
  }
  
  if (!activeApiKey) {
      const errorMsg = "Gemini API key is not available (neither system nor user-provided).";
      throw new Error(errorMsg);
  }

  if (useCache && cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
  }

  let lastError: any = null;

  for (const model of MODELS) {
    try {
      const aiText = await callGeminiModel(prompt, model, activeApiKey);
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
