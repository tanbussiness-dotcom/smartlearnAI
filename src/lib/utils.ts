import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A robust helper function to parse a JSON string from an AI's response.
 * It cleans markdown fences and handles common formatting issues.
 *
 * @param aiText - The text response from the Gemini API.
 * @returns The parsed JavaScript object, or an empty object if parsing fails.
 */
export function parseGeminiJson<T>(aiText: string): T {
  if (!aiText || typeof aiText !== "string") {
    return {} as T;
  }

  // Clean the string from markdown and trim whitespace
  let clean = aiText
    .replace(/```json|```/g, "")
    .trim();

  try {
    // Attempt to parse the cleaned string directly
    const parsed = JSON.parse(clean);
    return parsed as T;
  } catch (error) {
    // If parsing fails, it's a genuine error. Return empty object.
    // Further recovery attempts can be added here if needed,
    // but often the response from the LLM is the issue.
    return {} as T;
  }
}
