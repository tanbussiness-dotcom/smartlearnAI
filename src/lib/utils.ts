
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
    .replace(/[^\x20-\x7E]+/g, "")
    .trim();

  // 1️⃣ Parse trực tiếp
  try {
    const parsed = JSON.parse(clean);
    console.log(`[Gemini JSON] ✅ Parsed OK (${clean.length} chars)`);
    return parsed as T;
  } catch (err1: any) {
    console.warn("[Gemini JSON] ⚠️ First parse failed:", err1.message);
  }

  // 2️⃣ Vá cơ bản
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

  // 3️⃣ Deep Recovery: vá chuỗi bị đứt
  try {
    const partialMatch = clean.match(/\{[\s\S]*?[\}\]]?$/);
    if (partialMatch && partialMatch[0]) {
      let candidate = partialMatch[0];

      // Đếm và đóng dấu nháy nếu thiếu
      try {
        const quoteCount = (candidate.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) candidate += '"';
      } catch {}

      // Đóng ngoặc nếu thiếu
      if (!candidate.trim().endsWith("}") && !candidate.trim().endsWith("]")) {
        candidate += "}";
      }

      // Thay nháy sai & bỏ ký tự cuối lỗi
      candidate = candidate
        .replace(/\\+"/g, '"')
        .replace(/"([^"]*)$/g, '"$1"')
        .replace(/,\s*([}\]])/g, "$1"); // xóa dấu phẩy lẻ

      // Thử parse nhiều lần, mỗi lần cắt bớt cuối nếu lỗi
      for (let i = 0; i < 5; i++) {
        try {
          const parsedPartial = JSON.parse(candidate);
          console.log(`[Gemini JSON] ✅ Deep Recovery Success (${candidate.length} chars)`);
          return parsedPartial as T;
        } catch (errTry: any) {
          // Cắt bớt 20 ký tự cuối để loại bỏ chuỗi lỗi
          candidate = candidate.slice(0, -20).trim();
        }
      }
    }
  } catch (err3: any) {
    console.error("[Gemini JSON] ❌ Deep Recovery Exception:", err3.message);
  }

  // 4️⃣ Log preview để debug
  console.error("[Gemini JSON] ❌ All recovery attempts failed.");
  console.error("----- JSON Preview Start -----");
  console.error(clean.slice(0, 400));
  console.error("...");
  console.error(clean.slice(-400));
  console.error("----- JSON Preview End -----");

  return {} as T;
}
