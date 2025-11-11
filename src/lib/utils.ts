
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A robust helper function to parse a JSON string from an AI's response.
 * It cleans markdown fences, handles truncated responses, and attempts recovery.
 *
 * @param aiText - The text response from the Gemini API.
 * @returns The parsed JavaScript object.
 * @throws An error if parsing fails after all recovery attempts.
 */
export function parseGeminiJson<T>(aiText: string): T {
  if (!aiText || typeof aiText !== 'string') {
    throw new Error('Invalid input: AI response is null or not a string.');
  }

  // 1. Clean markdown fences and trim whitespace
  let clean = aiText.replace(/```json|```/g, '').trim();

  // 2. First attempt: Parse the cleaned string directly
  try {
    return JSON.parse(clean) as T;
  } catch (e: any) {
    console.warn('[parseGeminiJson] Initial parse failed. Attempting recovery...', {
      error: e.message,
      snippet: clean.substring(0, 100),
    });
  }

  // 3. Recovery attempt: Find the first '{' and last '}'
  try {
    const startIndex = clean.indexOf('{');
    const endIndex = clean.lastIndexOf('}');
    if (startIndex > -1 && endIndex > -1 && endIndex > startIndex) {
      const jsonBlock = clean.substring(startIndex, endIndex + 1);
      console.log('[parseGeminiJson] Attempting to parse extracted JSON block.');
      return JSON.parse(jsonBlock) as T;
    }
  } catch (e: any) {
    console.warn('[parseGeminiJson] Extracting JSON block failed.', {
      error: e.message,
    });
  }

  // 4. Final attempt: Throw an error if all else fails
  console.error('[parseGeminiJson] FATAL: All parsing attempts failed.');
  throw new Error('Failed to parse a valid JSON object from the AI response.');
}
