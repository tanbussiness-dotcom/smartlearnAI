import 'dotenv/config';
import fs from "fs";
import path from "path";
import { generateWithGemini } from "@/lib/gemini";

async function aiHealthCheck() {
  console.log("🧠 Checking Gemini API connectivity...\n");

  const tests = [
    "Say hello!",
    "Give one fact about AI.",
    "What year was Google founded?"
  ];

  const results: any[] = [];

  for (let i = 0; i < tests.length; i++) {
    const prompt = tests[i];
    console.log(`🔹 Test ${i + 1}: "${prompt}"`);
    const start = Date.now();

    try {
      const response = await generateWithGemini(prompt, false);
      const elapsed = Date.now() - start;
      console.log(`✅ Success (${elapsed}ms): ${response.slice(0, 80)}...\n`);
      results.push({ prompt, success: true, response: response.slice(0, 100), time_ms: elapsed });
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.error(`❌ Error (${elapsed}ms): ${err.message}\n`);
      results.push({ prompt, success: false, error: err.message, time_ms: elapsed });
    }
  }

  const logDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

  const logPath = path.join(logDir, `aiHealthCheck_${new Date().toISOString()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2));

  console.log(`🏁 Health check finished.\nResults saved at: ${logPath}`);
}

aiHealthCheck();
