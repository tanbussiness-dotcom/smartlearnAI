'use server';
/**
 * @fileOverview This file defines the Genkit flow for synthesizing a structured lesson from a curated list of sources.
 *
 * The flow takes a topic, a learning phase, and an array of source materials as input. It then leverages an
 * AI model to generate a comprehensive lesson, including a title, overview, structured content,
 * a curated list of sources, and a list of relevant videos.
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
    type: z.enum(['article', 'doc', 'tutorial', 'video']).describe("The type of content."),
    short_note: z.string().describe("A brief note on why this source is relevant or useful (1-2 sentences)."),
});

// Defines the schema for a video to be included in the output.
const VideoSchema = z.object({
    title: z.string().describe("The title of the video."),
    url: z.string().url().describe("The original YouTube watch URL (not an embed link)."),
    channel: z.string().describe("The name of the YouTube channel, if available."),
});

// Defines the schema for the flow's final output.
export const SynthesizeLessonOutputSchema = z.object({
  title: z.string().describe('A clear and concise title for the lesson.'),
  overview: z.string().describe('A short introductory paragraph that summarizes the main content of the lesson.'),
  content: z.string().describe('The full lesson content in Markdown or HTML format, at least 600 words, with clear sections and practical examples.'),
  sources: z.array(OutputSourceSchema).describe('A curated list of the most reliable sources used for synthesis.'),
  videos: z.array(VideoSchema).describe('A list of relevant videos found in the sources.'),
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

1.  **Generate Structured Content:** Create the lesson content ('content') in Markdown. It must be **at least 600 words**, well-organized, and include the following sections:
    *   **Introduction:** Briefly introduce the topic, its importance, and what the learner will achieve.
    *   **Core Concepts:** Explain the main ideas in a logical flow. Use clear headings for each concept.
    *   **Practical Examples:** Provide well-explained, easy-to-understand code snippets or real-world examples.
    *   **Conclusion:** Summarize the key takeaways and suggest next steps or areas for further exploration.

2.  **Write Original, Engaging Content:** Do NOT copy content directly from the sources. Synthesize the information in your own words to create a clear, practical, and easy-to-apply lesson. The tone should be encouraging and accessible.

3.  **Title and Overview:**
    *   Create a concise, descriptive 'title' for the lesson.
    *   Write a short introductory 'overview' that summarizes the lesson's main points.

4.  **Curate Sources and Videos:**
    *   From the input 'sources' list, select the most relevant and high-quality ones to include in the output 'sources' array. For each, add a 'short_note' explaining its value.
    *   If any of the sources are videos (especially from YouTube), extract their information and add them to the 'videos' array, including the 'title', original watch 'url', and 'channel' name if possible.

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

    // Post-processing to ensure video data is consistent, if needed.
    // For example, if AI puts a video in 'sources', we can move it to 'videos'.
    const videoSources = output.sources.filter(s => s.type === 'video');
    const existingVideoUrls = new Set(output.videos.map(v => v.url));

    for (const videoSource of videoSources) {
        if (!existingVideoUrls.has(videoSource.url)) {
            output.videos.push({
                title: videoSource.title,
                url: videoSource.url,
                channel: videoSource.domain === 'youtube.com' ? 'YouTube' : videoSource.domain,
            });
            existingVideoUrls.add(videoSource.url);
        }
    }
    
    return output;
  }
);
