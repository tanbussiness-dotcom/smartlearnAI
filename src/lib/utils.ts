
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
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]+/g, "") // remove non-ASCII control chars
    .trim();

  // 1️⃣ Parse thử bình thường
  try {
    const parsed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Parsed OK (${clean.length} chars)`);
    return parsed as T;
  } catch (err1: any) {
    console.warn("[Gemini JSON] ⚠️ First parse failed:", err1.message);
  }

  // 2️⃣ Thử vá nhẹ
  try {
    const lastBrace = clean.lastIndexOf("}");
    const lastBracket = clean.lastIndexOf("]");
    const cutIndex = Math.max(lastBrace, lastBracket);
    if (cutIndex > 0) clean = clean.substring(0, cutIndex + 1);
    if (!clean.endsWith("}") && !clean.endsWith("]")) clean += "}";

    const parsedFixed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Recovered OK (${clean.length} chars)`);
    return parsedFixed as T;
  } catch (err2: any) {
    console.warn("[Gemini JSON] ⚠️ Repair attempt failed:", err2.message);
  }

  // 3️⃣ Deep Recovery — vá lỗi chuỗi chưa đóng
  try {
    const partialMatch = clean.match(/\{[\s\S]*[\}\]]?/);
    if (partialMatch && partialMatch[0]) {
      let candidate = partialMatch[0];

      // Nếu JSON bị đứt giữa chuỗi, tự động đóng dấu nháy và ngoặc
      const quoteCount = (candidate.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) candidate += '"';
      if (!candidate.trim().endsWith("}") && !candidate.trim().endsWith("]")) candidate += "}";

      // Thay thế các dấu nháy lặp hoặc chuỗi không kết thúc
      candidate = candidate.replace(/\\+"/g, '"').replace(/"([^"]*)$/g, '"$1"');

      try {
        const parsedPartial = JSON.parse(candidate);
        console.log(`[Gemini JSON] ✅ Deep Recovery Success (${candidate.length} chars)`);
        return parsedPartial as T;
      } catch (err3: any) {
        console.error("[Gemini JSON] ❌ Deep Recovery parsing failed:", err3.message);
      }
    }
  } catch (errDeep: any) {
    console.error("[Gemini JSON] ❌ Deep Recovery Exception:", errDeep.message);
  }

  // 4️⃣ Ghi log preview cuối cùng
  console.error("[Gemini JSON] ❌ All recovery attempts failed.");
  console.error("----- JSON Preview Start -----");
  console.error(clean.slice(0, 300));
  console.error("...");
  console.error(clean.slice(-300));
  console.error("----- JSON Preview End -----");

  return {} as T;
}
