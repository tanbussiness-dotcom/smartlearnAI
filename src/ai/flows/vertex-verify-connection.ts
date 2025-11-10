'use server';
/**
 * @fileoverview A Genkit flow to verify the connection to Vertex AI.
 *
 * This flow initializes the Vertex AI client using a service account key,
 * lists available models, and runs a test generation with Gemini 1.5 Pro
 * to confirm that the connection and authentication are working correctly.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';
import { VertexAI } from '@google-cloud/vertexai';

const VertexVerificationOutputSchema = z.object({
  projectId: z.string(),
  location: z.string(),
  modelCount: z.number(),
  demoText: z.string(),
});

export const vertexVerifyConnection = ai.defineFlow(
  {
    name: 'vertexVerifyConnection',
    outputSchema: VertexVerificationOutputSchema,
  },
  async () => {
    // 1️⃣ Khởi tạo Vertex AI
    const vertexAI = new VertexAI({
      project: 'smartlearn-ai', // ⚠️ thay bằng projectId thật của bạn nếu khác
      location: 'us-central1',
      googleAuthOptions: { keyFile: './vertex-ai-admin.json' },
    });

    console.log('✅ Vertex AI client initialized successfully.');

    // 2️⃣ Lấy danh sách model khả dụng
    const modelList = await vertexAI.listModels();
    const availableModels = modelList.map((m: any) => m.name);
    console.log('📦 Available models:', availableModels);

    // 3️⃣ Gọi thử model Gemini 1.5 Pro
    const gemini = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-pro-001',
    });

    const prompt = `
    Viết một đoạn ngắn (100 từ) giới thiệu tổng quan về trí tuệ nhân tạo (AI)
    và ứng dụng của nó trong giáo dục hiện đại.
    `;

    const response = await gemini.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const demoText =
      response.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Không có phản hồi từ model.';

    console.log('🧠 Gemini 1.5 Pro demo output:', demoText);

    return {
      projectId: vertexAI.project,
      location: vertexAI.location,
      modelCount: availableModels.length,
      demoText,
    };
  }
);
