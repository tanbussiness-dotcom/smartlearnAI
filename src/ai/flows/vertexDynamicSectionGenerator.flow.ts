
'use server';
/**
 * @fileOverview Defines the server action for dynamically generating lesson section content using Gemini API.
 *
 * @exports vertexDynamicSectionGenerator - The main function to generate a lesson section.
 */

import { z } from 'zod';
import { generateWithGemini, parseGeminiJson } from '@/lib/gemini';

// Defines the schema for the flow's input.
const VertexDynamicSectionGeneratorInputSchema = z.object({
  topic: z.string().describe('The overall topic of the lesson.'),
  sectionId: z.string().describe('The ID of the section.'),
  sectionTitle: z.string().describe('The title of the section.'),
  sectionGoal: z.string().describe('The learning goal of the section.'),
});
export type VertexDynamicSectionGeneratorInput = z.infer<
  typeof VertexDynamicSectionGeneratorInputSchema
>;

// Defines the schema for the quiz question.
const QuizQuestionSchema = z.object({
  question: z.string().describe('A question based on the content.'),
  options: z.array(z.string()).describe('An array of possible answers.'),
  correctAnswer: z.string().describe('The correct answer.'),
});

// Defines the schema for the flow's output.
const VertexDynamicSectionGeneratorOutputSchema = z.object({
  sectionId: z.string().describe('The ID of the generated section.'),
  title: z.string().describe('The title of the generated section.'),
  content: z.string().describe('The detailed content for the section.'),
  quiz: z
    .array(QuizQuestionSchema)
    .describe('An array containing a single quiz question.'),
});
export type VertexDynamicSectionGeneratorOutput = z.infer<
  typeof VertexDynamicSectionGeneratorOutputSchema
>;

export async function vertexDynamicSectionGenerator(
  input: VertexDynamicSectionGeneratorInput
): Promise<VertexDynamicSectionGeneratorOutput> {
  console.log(`🚀 Generating section content: ${input.sectionTitle}`);

  const prompt = `
    Viết nội dung chi tiết cho phần "${input.sectionTitle}" thuộc bài học "${input.topic}".
    Mục tiêu phần này: "${input.sectionGoal}".
    Yêu cầu:
    - Nội dung dễ hiểu, logic, 400–700 từ.
    - Có ví dụ minh họa nếu cần.
    - Kết thúc bằng phần tóm tắt ngắn.
    - Tạo một câu hỏi trắc nghiệm (quiz) với question, options (4 lựa chọn), và correctAnswer.
    - Trả kết quả dạng JSON.

    Không thêm markdown hay \`\`\`json, chỉ trả về JSON thuần.
    `;
  
  const aiText = await generateWithGemini(prompt);
  const output = parseGeminiJson<VertexDynamicSectionGeneratorOutput>(aiText);

  console.log(`✅ Section generated: ${output.title}`);
  return VertexDynamicSectionGeneratorOutputSchema.parse(output);
}
