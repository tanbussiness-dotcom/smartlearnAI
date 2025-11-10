import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A helper function to parse a JSON string from the AI's response.
 * It removes markdown code fences and trims whitespace before parsing.
 * 
 * @param aiText - The text response from the Gemini API.
 * @returns The parsed JavaScript object.
 * @throws An error if the JSON is invalid.
 */
export function parseGeminiJson<T>(aiText: string): T {
  const cleanText = aiText.replace(/```json|```/g, "").trim();
  if (!cleanText) {
    throw new Error("AI returned an empty response.");
  }
  try {
    return JSON.parse(cleanText) as T;
  } catch (error: any) {
    console.error("Failed to parse JSON from AI response:", cleanText);
    throw new Error(`Invalid JSON format from AI: ${error.message}`);
  }
}
