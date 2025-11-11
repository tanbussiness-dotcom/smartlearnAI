import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A robust helper function to parse a JSON string from an AI's response.
 * It cleans markdown fences, handles common formatting issues, and attempts
 * to recover from incomplete or malformed JSON before failing gracefully.
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
    .replace(/\u0000/g, "") // Remove null characters
    .replace(/\\u00([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))) // Decode \\u00xx
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))  // Decode \\uxxxx
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '\"')
    .normalize("NFC") // Normalize Vietnamese characters
    .replace(/[^\x00-\x7F]/g, (char) => { // Re-escape non-ASCII characters for JSON safety
        if (char === ' ' || char === '\n' || char === '\r' || char === '\t') return char;
        return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
    })
    .replace(/[\r\n\t]+/g, " ") // Now collapse whitespace
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
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
      
      // Bảo vệ null
      if (!candidate || candidate.length < 5) {
        console.warn("[Gemini JSON] ⚠️ Candidate quá ngắn để parse.");
        throw new Error("Candidate too short");
      }

      // Đếm và đóng nháy an toàn
      try {
        const quoteCount = (candidate.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) candidate += '"';
      } catch {
        console.warn("[Gemini JSON] ⚠️ Quote repair skipped (invalid match).");
      }

      // Đóng ngoặc nếu thiếu
      if (!candidate.trim().endsWith("}") && !candidate.trim().endsWith("]")) candidate += "}";

      // Thay ký tự lỗi thường gặp
      candidate = candidate
        .replace(/\\+"/g, '"')
        .replace(/"([^"]*)$/g, '"$1"')
        .replace(/,\s*([}\]])/g, "$1");

      // Thử parse giảm dần độ dài
      for (let i = 0; i < 5; i++) {
        try {
          const parsedPartial = JSON.parse(candidate);
          console.log(`[Gemini JSON] ✅ Deep Recovery Success (${candidate.length} chars)`);
          return parsedPartial as T;
        } catch (errTry: any) {
          // Progressively trim the end of the string
          candidate = candidate.slice(0, -Math.min(20 * (i + 1), Math.floor(candidate.length / 4))).trim();
        }
      }
    }
  } catch (err3: any) {
    console.error("[Gemini JSON] ❌ Deep Recovery exception:", err3.message);
  }

  // 4️⃣ Log preview để debug
  console.error("[Gemini JSON] ❌ All recovery attempts failed.");
  console.error("----- JSON Preview Start -----");
  console.error(clean.slice(0, 400));
  console.error("...");
  console.error(clean.slice(-400));
  console.error("----- JSON Preview End -----");

  console.error("[Gemini JSON] ❌ Return fallback {} (unrecoverable JSON).");
  return {} as T;
}
