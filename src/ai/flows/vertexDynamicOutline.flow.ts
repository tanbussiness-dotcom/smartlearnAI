
'use server';
/**
 * @fileOverview Defines the server action for creating a dynamic lesson outline using Gemini API.
 *
 * @exports vertexDynamicOutline - The main function to generate a lesson outline.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';

// Defines the schema for the flow's input.
const VertexDynamicOutlineInputSchema = z.object({
  topic: z.string().describe('The main topic for the lesson outline.'),
  level: z
    .string()
    .default('beginner')
    .describe('The difficulty level of the lesson (e.g., beginner, intermediate, advanced).'),
  targetAudience: z
    .string()
    .default('general learner')
    .describe('The intended audience for the lesson.'),
});
export type VertexDynamicOutlineInput = z.infer<
  typeof VertexDynamicOutlineInputSchema
>;

// Defines the schema for a single section in the outline.
const OutlineSectionSchema = z.object({
  sectionId: z
    .string()
    .describe('A short, slug-like identifier for the section.'),
  title: z.string().describe('The title of the lesson section.'),
  goal: z.string().describe('The learning objective for this section.'),
  status: z
    .string()
    .default('not_started')
    .describe('The initial status of the section.'),
});

// Defines the schema for the flow's output.
const VertexDynamicOutlineOutputSchema = z.object({
  title: z.string().describe('The generated title for the entire lesson.'),
  overview: z
    .string()
    .describe('A 3-5 sentence overview of the lesson content.'),
  outline: z
    .array(OutlineSectionSchema)
    .describe('An array of sections that make up the lesson outline.'),
});
export type VertexDynamicOutlineOutput = z.infer<
  typeof VertexDynamicOutlineOutputSchema
>;

export async function vertexDynamicOutline(
  input: VertexDynamicOutlineInput
): Promise<VertexDynamicOutlineOutput> {
  console.log(`🚀 Generating adaptive outline for topic: ${input.topic}`);

  const prompt = `Bạn là chuyên gia thiết kế khóa học. 
Hãy tạo cấu trúc bài học dễ hiểu nhất cho chủ đề "${input.topic}".
- Cấp độ: ${input.level}
- Đối tượng học: ${input.targetAudience}
- Hãy tự quyết định số phần hợp lý (từ 3 đến 8 phần).
- Mỗi phần có: sectionId (slug ngắn gọn), title (tên phần), goal (mục tiêu học tập), status ("not_started").
- Trả kết quả dạng JSON.

Không thêm markdown hay \`\`\`json, chỉ trả về JSON thuần.
`;
  
  const aiText = await generateWithGemini(prompt);
  const output = parseGeminiJson<VertexDynamicOutlineOutput>(aiText);

  console.log(`✅ Adaptive outline created: ${output.title}`);
  return VertexDynamicOutlineOutputSchema.parse(output);
}
