'use server';
import 'dotenv/config';
import { generateWithGemini } from "@/lib/gemini";

async function aiHealthCheck() {
  console.log("🧠 Checking Gemini API connectivity...\n");

  const tests = [
    "Hello Gemini! Just say hi.",
    "Give me a random fact about AI in one sentence.",
    "What year was Google founded?"
  ];

  for (let i = 0; i < tests.length; i++) {
    const prompt = tests[i];
    console.log(`🔹 Test ${i + 1}: "${prompt}"`);
    const start = Date.now();

    try {
      const response = await generateWithGemini(prompt, false);
      const elapsed = Date.now() - start;
      console.log(`✅ Success (${elapsed}ms): ${response.slice(0, 60)}...\n`);
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.error(`❌ Error (${elapsed}ms): ${err.message}\n`);
    }
  }

  console.log("🏁 Health check finished.\n");
}

aiHealthCheck();
