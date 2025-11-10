
'use server';
/**
 * @fileOverview Defines the server action for dynamically generating lesson section content using Gemini API.
 *
 * @exports vertexDynamicSectionGenerator - The main function to generate a lesson section.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';

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
    .min(1)
    .describe('An array containing at least one quiz question.'),
});
export type VertexDynamicSectionGeneratorOutput = z.infer<
  typeof VertexDynamicSectionGeneratorOutputSchema
>;

export async function vertexDynamicSectionGenerator(
  input: VertexDynamicSectionGeneratorInput
): Promise<VertexDynamicSectionGeneratorOutput> {
  console.log(`🚀 Generating section content: ${input.sectionTitle}`);

  const prompt = `
    Bạn là chuyên gia viết tài liệu hướng dẫn. Hãy viết nội dung chi tiết cho phần "${input.sectionTitle}" thuộc chủ đề "${input.topic}".
    Mục tiêu của phần này là: "${input.sectionGoal}".

    **Yêu cầu:**
    1.  **Nội dung ("content"):**
        - Viết bằng Markdown, có độ dài từ 400 đến 700 từ.
        - Nội dung phải rõ ràng, logic, dễ hiểu.
        - Bắt buộc phải có ít nhất một ví dụ thực tế hoặc đoạn code (nếu phù hợp) để minh họa.
        - Kết thúc bằng một đoạn tóm tắt ngắn các điểm chính.
    
    2.  **Câu hỏi trắc nghiệm ("quiz"):**
        - Tạo một mảng chứa **một** câu hỏi trắc nghiệm (multiple-choice).
        - Mỗi câu hỏi phải có: "question" (chuỗi), "options" (mảng 4 chuỗi), và "correctAnswer" (chuỗi - một trong các options).
    
    3.  **Định dạng JSON:**
        - Toàn bộ kết quả trả về phải là một đối tượng JSON duy nhất.
        - Đối tượng JSON phải tuân thủ nghiêm ngặt cấu trúc sau:
    
    \`\`\`json
    {
      "sectionId": "${input.sectionId}",
      "title": "Tiêu đề của phần học (giống input)",
      "content": "Nội dung chi tiết viết bằng Markdown...",
      "quiz": [
        {
          "question": "Nội dung câu hỏi?",
          "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
          "correctAnswer": "Lựa chọn đúng"
        }
      ]
    }
    \`\`\`

    **Lưu ý quan trọng:** Không thêm ký tự markdown \`\`\`json ở đầu hoặc cuối. Chỉ trả về đối tượng JSON thuần.
    `;
  
  const aiText = await generateWithGemini(prompt);
  let output = parseGeminiJson<VertexDynamicSectionGeneratorOutput>(aiText);

  // Ensure the sectionId from the input is always present in the output
  // to prevent AI from omitting it.
  output.sectionId = input.sectionId;

  console.log(`✅ Section generated: ${output.title}`);
  return VertexDynamicSectionGeneratorOutputSchema.parse(output);
}
