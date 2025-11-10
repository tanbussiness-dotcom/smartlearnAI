
'use server';
/**
 * @fileOverview Defines the Genkit flow for dynamically generating lesson section content.
 *
 * This flow takes a topic and section details to generate detailed content
 * and a simple quiz question for a specific part of a lesson.
 *
 * @exports vertexDynamicSectionGenerator - The main function to generate a lesson section.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';


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

const prompt = ai.definePrompt({
  name: 'vertexDynamicSectionGeneratorPrompt',
  input: { schema: VertexDynamicSectionGeneratorInputSchema },
  output: { schema: VertexDynamicSectionGeneratorOutputSchema },
  prompt: `
    Viết nội dung chi tiết cho phần "{{sectionTitle}}" thuộc bài học "{{topic}}".
    Mục tiêu phần này: "{{sectionGoal}}".
    Yêu cầu:
    - Nội dung dễ hiểu, logic, 400–700 từ.
    - Có ví dụ minh họa nếu cần.
    - Kết thúc bằng phần tóm tắt ngắn.
    - Trả kết quả dạng JSON.

    Không thêm markdown hay \`\`\`json, chỉ trả về JSON thuần.
    `,
});

export const vertexDynamicSectionGenerator = ai.defineFlow(
  {
    name: 'vertexDynamicSectionGenerator',
    inputSchema: VertexDynamicSectionGeneratorInputSchema,
    outputSchema: VertexDynamicSectionGeneratorOutputSchema,
  },
  async (input) => {
    console.log(`🚀 Generating section content: ${input.sectionTitle}`);

    const { output } = await prompt(input, { model: googleAI.model('gemini-pro') });
    if (!output) {
      throw new Error('Failed to get a valid response from the AI model.');
    }

    console.log(`✅ Section generated: ${output.title}`);
    return output;
  }
);
