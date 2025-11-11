
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

  let clean = aiText
    .replace(/```json|```/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\u0000/g, "")
    .trim();

  // 1️⃣ Thử parse bình thường
  try {
    const parsed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Parsed OK (${clean.length} chars)`);
    return parsed as T;
  } catch (err1: any) {
    console.warn("[Gemini JSON] ⚠️ First parse failed:", err1.message);
  }

  // 2️⃣ Thử vá JSON (cắt phần dư, thêm ngoặc)
  try {
    const lastBrace = clean.lastIndexOf("}");
    const lastBracket = clean.lastIndexOf("]");
    const cutIndex = Math.max(lastBrace, lastBracket);
    if (cutIndex > 0) clean = clean.substring(0, cutIndex + 1);
    if (!clean.endsWith("}") && !clean.endsWith("]")) clean += "}";
    clean = clean.replace(/“|”/g, '"').replace(/‘|’/g, "'");

    const parsedFixed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Recovered OK (${clean.length} chars)`);
    return parsedFixed as T;
  } catch (err2: any) {
    console.warn("[Gemini JSON] ⚠️ Repair attempt failed:", err2.message);
  }

  // 3️⃣ Deep Recovery: Tìm phần JSON hợp lệ nhất bằng regex
  try {
    const partialMatch = clean.match(/\{[\s\S]*[\}\]]/);
    if (partialMatch && partialMatch[0]) {
      const candidate = partialMatch[0];
      const repaired = candidate.replace(/\\+"/g, '"').replace(/"([^"]*)$/g, '$1"');
      const parsedPartial = JSON.parse(repaired);
      console.log(`[Gemini JSON] ✅ Deep Recovery Success (${repaired.length} chars)`);
      return parsedPartial as T;
    }
  } catch (err3: any) {
    console.error("[Gemini JSON] ❌ Deep Recovery Failed:", err3.message);
  }

  // 4️⃣ Ghi log preview
  console.error("[Gemini JSON] ❌ All recovery attempts failed.");
  console.error("----- JSON Preview Start -----");
  console.error(clean.slice(0, 200));
  console.error("...");
  console.error(clean.slice(-200));
  console.error("----- JSON Preview End -----");

  return {} as T;
}
