
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A helper function to parse a JSON string from the AI's response.
 * It removes markdown code fences, cleans up common formatting issues,
 * and retries parsing if the initial attempt fails.
 *
 * @param aiText - The text response from the Gemini API.
 * @returns The parsed JavaScript object.
 * @throws An error if the JSON is invalid after cleanup and retries.
 */
export function parseGeminiJson<T>(aiText: string): T {
  // Step 1: Find the JSON block within the text
  let jsonString = aiText;
  const match = /```json\s*([\s\S]*?)\s*```/.exec(aiText);

  if (match && match[1]) {
    jsonString = match[1];
  } else {
    // Fallback for cases where markdown fences are missing
    const jsonStart = aiText.indexOf('{');
    const jsonEnd = aiText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonString = aiText.substring(jsonStart, jsonEnd + 1);
    }
  }

  // Step 2: Basic cleanup
  jsonString = jsonString
    .replace(/[“”]/g, '"') // Replace curly quotes with straight quotes
    .trim();

  if (!jsonString) {
    throw new Error("AI returned an empty response or no valid JSON block was found.");
  }

  try {
    // First attempt to parse
    return JSON.parse(jsonString) as T;
  } catch (error: any) {
    console.warn("Initial JSON parse failed. Retrying after more aggressive cleanup...");

    // Remove comments and all newlines, then try to remove trailing commas
    const singleLineText = jsonString
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
        .replace(/\n|\r/g, '') // Remove all newlines
        .replace(/,\s*(}|])/g, "$1"); // Re-apply trailing comma removal

    try {
      return JSON.parse(singleLineText) as T;
    } catch (finalError: any) {
      console.error("Failed to parse JSON from AI response even after cleanup:", singleLineText);
      throw new Error(`Invalid JSON format from AI: ${finalError.message}`);
    }
  }
}
