
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
  // Step 1: Basic cleanup
  let cleanText = aiText
    .replace(/```json|```/g, "") // Remove markdown code fences
    .replace(/[“”]/g, '"') // Replace curly quotes with straight quotes
    .trim();

  // Step 2: Remove trailing commas before brackets and braces
  cleanText = cleanText.replace(/,\s*(}|])/g, "$1");

  if (!cleanText) {
    throw new Error("AI returned an empty response.");
  }

  try {
    // First attempt to parse
    return JSON.parse(cleanText) as T;
  } catch (error: any) {
    // If parsing fails, try a more aggressive cleanup
    console.warn("Initial JSON parse failed. Retrying after more aggressive cleanup...");
    
    // Remove all newlines and then try to remove trailing commas again
    const singleLineText = cleanText.replace(/\n/g, "").replace(/,\s*(}|])/g, "$1");

    try {
      return JSON.parse(singleLineText) as T;
    } catch (finalError: any) {
      console.error("Failed to parse JSON from AI response even after cleanup:", singleLineText);
      throw new Error(`Invalid JSON format from AI: ${finalError.message}`);
    }
  }
}
