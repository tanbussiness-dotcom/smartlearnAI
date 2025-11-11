
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A robust helper function to parse a JSON string from an AI's response.
 * It cleans markdown fences, handles common formatting issues, and attempts
 * to recover from incomplete JSON before failing gracefully.
 *
 * @param aiText - The text response from the Gemini API.
 * @returns The parsed JavaScript object, or an empty object if parsing fails.
 * @throws An error if the JSON is invalid after cleanup and retries.
 */
export function parseGeminiJson<T>(aiText: string): T {
  // Step 1: Remove markdown fences and trim whitespace
  let clean = aiText.replace(/```json|```/g, '').trim();

  try {
    // First attempt to parse the cleaned string
    const result = JSON.parse(clean) as T;
    console.log(`[Gemini JSON] Valid JSON parsed successfully (length: ${clean.length})`);
    return result;
  } catch (error) {
    console.warn('[Gemini JSON] First parse failed, attempting auto-fix...');
    
    // Step 2: Attempt recovery for common issues (e.g., trailing characters, incomplete object)
    try {
      // Find the last closing brace '}' and assume it's the end of the valid JSON
      const lastBraceIndex = clean.lastIndexOf('}');
      if (lastBraceIndex !== -1) {
        const truncated = clean.substring(0, lastBraceIndex + 1);
        const result = JSON.parse(truncated) as T;
        console.log(`[Gemini JSON] Successfully parsed after truncating to last '}'.`);
        return result;
      }
      throw new Error("No closing brace found for recovery.");
    } catch (recoveryError) {
      // Step 3: If recovery fails, log detailed error and return an empty object
      console.error(
        '[Gemini JSON] Failed after recovery attempts. Original text (first 200/last 200 chars):',
        clean.slice(0, 200),
        '...',
        clean.slice(-200)
      );
      // Return an empty object to prevent the entire system from crashing
      return {} as T;
    }
  }
}
