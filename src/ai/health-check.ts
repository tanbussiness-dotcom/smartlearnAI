
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
  let hasApiError = false;

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
      
      if (err.message && (err.message.includes('503') || err.message.includes('403') || err.message.includes('429'))) {
        hasApiError = true;
      }
    }
  }

  // --- Statistics Calculation ---
  const successfulTests = results.filter(r => r.success);
  const totalTests = results.length;
  const successRate = totalTests > 0 ? (successfulTests.length / totalTests) * 100 : 0;
  
  const totalResponseTime = successfulTests.reduce((acc, r) => acc + r.time_ms, 0);
  const averageResponseTime = successfulTests.length > 0 ? totalResponseTime / successfulTests.length : 0;

  const logDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

  const logPath = path.join(logDir, `aiHealthCheck_${new Date().toISOString()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2));

  console.log(`🏁 Health check finished.`);
  console.log("--------------------");
  console.log("📊 Stats:");
  console.log(`- Success Rate: ${successRate.toFixed(2)}% (${successfulTests.length}/${totalTests})`);
  if (successfulTests.length > 0) {
    console.log(`- Avg. Response Time: ${averageResponseTime.toFixed(0)}ms`);
  }
  console.log("--------------------");
  console.log(`Results saved at: ${logPath}`);

  // --- Alerting Logic ---
  const SUCCESS_RATE_THRESHOLD = 70;
  const AVG_RESPONSE_TIME_THRESHOLD = 8000;

  if (successRate < SUCCESS_RATE_THRESHOLD || (successfulTests.length > 0 && averageResponseTime > AVG_RESPONSE_TIME_THRESHOLD)) {
    const timestamp = new Date().toISOString();
    const alertMessage = `⚠️ SmartLearn AI Warning: Model stability degraded. Success Rate: ${successRate.toFixed(2)}%, Avg Latency: ${averageResponseTime.toFixed(0)}ms`;
    
    console.log('\x1b[31m%s\x1b[0m', '\n====================\n');
    console.log('\x1b[31m%s\x1b[0m', '  AI SYSTEM ALERT');
    console.log('\x1b[31m%s\x1b[0m', alertMessage);
    console.log('\x1b[31m%s\x1b[0m', '\n====================\n');

    const alertLogPath = path.join(logDir, 'aiAlerts.json');
    const alertLogEntry = {
      timestamp,
      alert: alertMessage,
      details: {
        successRate: successRate.toFixed(2),
        averageResponseTime: averageResponseTime.toFixed(0),
        thresholds: {
          successRate: SUCCESS_RATE_THRESHOLD,
          responseTime: AVG_RESPONSE_TIME_THRESHOLD,
        },
        fullReport: logPath,
      },
    };

    let existingAlerts = [];
    if (fs.existsSync(alertLogPath)) {
      try {
        existingAlerts = JSON.parse(fs.readFileSync(alertLogPath, 'utf-8'));
      } catch (e) {
        console.error('Could not parse existing aiAlerts.json. Overwriting.');
      }
    }
    existingAlerts.push(alertLogEntry);
    fs.writeFileSync(alertLogPath, JSON.stringify(existingAlerts, null, 2));
    console.log(`Alert logged to: ${alertLogPath}`);
  }


  if (hasApiError) {
    console.log('\x1b[33m%s\x1b[0m', '\n⚠️ Gemini connectivity unstable — please check API quota or model region.');
  }
}

aiHealthCheck();
