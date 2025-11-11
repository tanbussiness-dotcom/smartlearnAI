
'use server';
/**
 * @fileOverview This file defines the function for synthesizing a structured lesson from a curated list of sources using Gemini API.
 *
 * @exports synthesizeLesson - The main function to synthesize a lesson.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';
import { SynthesizeLessonOutputSchema } from './types';

// Defines the schema for a single source provided as input.
const InputSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  type: z.enum(['article', 'doc', 'video', 'tutorial']),
  relevance: z.number(),
});

// Defines the schema for the flow's input.
const SynthesizeLessonInputSchema = z.object({
  topic: z.string().describe('The main topic of the lesson to be synthesized.'),
  phase: z.string().describe('The learning phase, e.g., "Beginner", "Intermediate", "Advanced".'),
  sources: z.array(InputSourceSchema).describe('An array of source materials to use for synthesis.'),
});
type SynthesizeLessonInput = z.infer<typeof SynthesizeLessonInputSchema>;
type SynthesizeLessonOutput = z.infer<typeof SynthesizeLessonOutputSchema>;

// Partial schema for what we expect from the AI.
const AISynthesisSchema = z.object({
  title: z.string().describe('A clear and concise title for the lesson.'),
  overview: z.string().describe('A short introductory paragraph that summarizes the main content of the lesson.'),
  content: z.string().describe('The full lesson content in Markdown or HTML format, between 800 and 1200 words, with clear sections and practical examples.'),
  estimated_time_min: z.number().describe('Estimated time in minutes to complete the lesson.'),
});

export async function synthesizeLesson(input: SynthesizeLessonInput): Promise<SynthesizeLessonOutput> {
  const sourcesString = JSON.stringify(input.sources.map(s => ({ url: s.url, title: s.title, type: s.type })), null, 2);

  const prompt = `You are an expert instructional designer and technical writer. Your task is to synthesize a high-quality, comprehensive, and structured learning lesson from the provided sources about the given topic and phase.

Topic: ${input.topic}
Phase: ${input.phase}
Sources (for context):
${sourcesString}

**Your response MUST be a JSON object containing ONLY the following keys: "title", "overview", "content", and "estimated_time_min".**

**Instructions for the content:**

1.  **Generate In-Depth, Structured Content:** Create the lesson content ('content') in **Markdown**. It must be between **800 and 1200 words**, well-organized, and include the following sections using appropriate Markdown headings (##, ###):
    *   **Introduction:** Introduce the core concepts, explain their importance, and describe their practical applications.
    *   **Main Body:** Logically break down the topic into several sub-sections. Explain each concept clearly and thoroughly.
        *   Provide **at least 3 practical, real-world examples** to illustrate the concepts.
        *   If applicable, include formulas, tables, or visual descriptions.
    *   **Conclusion:** Summarize the key takeaways and provide specific, actionable practice suggestions or exercises for the learner.

2.  **Estimate Time:** Based on the content, provide an 'estimated_time_min'.
3.  **Title and Overview:** Create a concise 'title' and a short 'overview'.
4.  **Write Original Content:** Do NOT copy content directly. Synthesize the information in your own words. The tone should be encouraging and accessible but technically accurate.

Your final output must be a single, valid JSON object that strictly conforms to the requested structure.
`;

  const aiText = await generateWithGemini(prompt);
  const aiOutput = parseGeminiJson<z.infer<typeof AISynthesisSchema>>(aiText);

  // Ensure the core content exists. If not, throw an error.
  if (!aiOutput || !aiOutput.content) {
      throw new Error("Failed to generate a valid lesson structure from AI. The 'content' field is missing.");
  }
  
  // Assemble the final output object on the client side for reliability
  const finalOutput: SynthesizeLessonOutput = {
    ...aiOutput,
    sources: input.sources.map(s => ({
        ...s,
        short_note: `A resource for learning about ${input.topic}.` // Add a generic but useful note
    })),
    videos: input.sources
        .filter(s => s.type === 'video')
        .map(s => ({
            title: s.title,
            url: s.url,
            channel: s.domain === 'youtube.com' ? 'YouTube' : s.domain,
        })),
  };

  return SynthesizeLessonOutputSchema.parse(finalOutput);
}
