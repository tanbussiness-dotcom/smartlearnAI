'use server';
/**
 * @fileOverview This file defines the Genkit flow for synthesizing a structured lesson from a curated list of sources.
 *
 * The flow takes a topic, a learning phase, and an array of source materials as input. It then leverages an
 * AI model to generate a comprehensive lesson, including a title, summary, structured content, estimated
 * completion time, and a list of video links found in the sources.
 *
 * @exports synthesizeLesson - The main function to synthesize a lesson.
 * @exports SynthesizeLessonInput - The input type for the synthesizeLesson function.
 * @exports SynthesizeLessonOutput - The output type for the synthesizeLesson function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Defines the schema for a single source provided as input.
const InputSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  type: z.enum(['article', 'doc', 'video', 'tutorial']),
  relevance: z.number(),
});

// Defines the schema for the flow's input.
export const SynthesizeLessonInputSchema = z.object({
  topic: z.string().describe('The main topic of the lesson to be synthesized.'),
  phase: z.string().describe('The learning phase, e.g., "Beginner", "Intermediate", "Advanced".'),
  sources: z.array(InputSourceSchema).describe('An array of source materials to use for synthesis.'),
});
export type SynthesizeLessonInput = z.infer<typeof SynthesizeLessonInputSchema>;


// Defines the schema for a single source to be included in the output.
const OutputSourceSchema = z.object({
    title: z.string().describe("The title of the source."),
    url: z.string().url().describe("The URL of the source."),
    domain: z.string().describe("The domain of the source."),
    type: z.enum(['article', 'doc', 'video', 'tutorial']).describe("The type of content."),
    short_note: z.string().describe("A brief note on why this source is relevant or useful."),
});

// Defines the schema for the flow's final output.
export const SynthesizeLessonOutputSchema = z.object({
  title: z.string().describe('A clear and concise title for the lesson.'),
  summary: z.string().max(50, "Summary must be 50 words or less.").describe('A summary of the lesson, no more than 50 words.'),
  synthesized_content: z.string().describe('The full lesson content in Markdown or HTML format.'),
  estimated_time_min: z.number().describe('The estimated time in minutes to complete the lesson.'),
  sources: z.array(OutputSourceSchema).describe('A list of the most reliable sources used for synthesis.'),
  video_links: z.array(z.string().url()).describe('A list of direct URLs to relevant videos from the sources.'),
});
export type SynthesizeLessonOutput = z.infer<typeof SynthesizeLessonOutputSchema>;

export async function synthesizeLesson(input: SynthesizeLessonInput): Promise<SynthesizeLessonOutput> {
  return synthesizeLessonFlow(input);
}

const synthesizePrompt = ai.definePrompt({
  name: 'synthesizeLessonPrompt',
  input: {schema: SynthesizeLessonInputSchema},
  output: {schema: SynthesizeLessonOutputSchema},
  prompt: `You are an expert instructional designer. Your task is to synthesize a high-quality, structured learning lesson from the provided sources about the given topic and phase.

Topic: {{{topic}}}
Phase: {{{phase}}}
Sources:
{{{jsonStringify sources}}}

**Your response MUST follow these instructions:**

1.  **Generate Structured Content:** Create the lesson content ('synthesized_content') in Markdown. It must be well-organized and include the following sections:
    *   **Introduction:** Briefly introduce the topic and what the learner will achieve.
    *   **Core Concepts:** Explain the main ideas and knowledge in a clear, logical flow.
    *   **Examples:** Provide practical, easy-to-understand code snippets or real-world examples.
    *   **Exercises:** Suggest 1-2 simple exercises or questions to help the learner practice and test their understanding.
    *   **Further Reading:** Reference the sources used.

2.  **Write Original Content:** Do NOT copy content directly from the sources. Synthesize the information in your own words to create a clear, easy-to-understand lesson. The tone should be encouraging and accessible.

3.  **Title and Summary:**
    *   Create a concise, descriptive 'title' for the lesson.
    *   Write a 'summary' that is **50 words or less**.

4.  **Time Estimate:** Provide a realistic 'estimated_time_min' for an average learner to complete the lesson.

5.  **Curate Sources:** From the input 'sources' list, select the most relevant and high-quality ones to include in the output 'sources' array. For each, add a 'short_note' explaining its value.

6.  **Extract Video Links:** Identify all sources of type 'video' and add their 'url' to the 'video_links' array.

Your final output must be a single, valid JSON object that strictly conforms to the provided output schema.`,
});

const synthesizeLessonFlow = ai.defineFlow(
  {
    name: 'synthesizeLessonFlow',
    inputSchema: SynthesizeLessonInputSchema,
    outputSchema: SynthesizeLessonOutputSchema,
  },
  async input => {
    const {output} = await synthesizePrompt(input);
    if (!output) {
      throw new Error("Failed to get a valid response from the AI model.");
    }

    // Ensure video links are properly extracted from the sources provided in the output
    const videoLinks = output.sources.filter(s => s.type === 'video').map(s => s.url);
    
    return {
        ...output,
        video_links: videoLinks,
    };
  }
);
