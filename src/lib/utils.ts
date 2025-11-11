
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
 */
export function parseGeminiJson<T>(aiText: string): T {
  if (!aiText || typeof aiText !== "string") {
    console.error("[Gemini JSON] ❌ Empty or invalid AI response.");
    return {} as T;
  }

  // Step 1: Clean the original string
  let clean = aiText
    .replace(/```json|```/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\u0000/g, "")
    .trim();

  // Step 2: First parse attempt
  try {
    const parsed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Parsed OK (${clean.length} chars)`);
    return parsed as T;
  } catch (err1: any) {
    console.warn("[Gemini JSON] ⚠️ First parse failed:", err1.message);
  }

  // Step 3: Attempt to repair the JSON
  try {
    // Cut off any trailing characters after the last brace/bracket
    const lastBrace = clean.lastIndexOf("}");
    const lastBracket = clean.lastIndexOf("]");
    const cutIndex = Math.max(lastBrace, lastBracket);
    if (cutIndex > 0) clean = clean.substring(0, cutIndex + 1);

    // Add a closing brace if it seems to be missing
    if (!clean.endsWith("}") && !clean.endsWith("]")) {
      clean += "}";
    }

    // Replace curly quotes with straight quotes
    clean = clean.replace(/“|”/g, '"').replace(/‘|’/g, "'");

    const parsedFixed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Recovered OK (${clean.length} chars)`);
    return parsedFixed as T;
  } catch (err2: any) {
    console.error("[Gemini JSON] ❌ Parse failed after repair:", err2.message);
    console.error("----- JSON Preview Start -----");
    console.error(clean.slice(0, 200));
    console.error("...");
    console.error(clean.slice(-200));
    console.error("----- JSON Preview End -----");
    return {} as T;
  }
}
