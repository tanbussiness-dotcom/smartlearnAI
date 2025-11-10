
'use server';
/**
 * @fileOverview This file defines the function for synthesizing a structured lesson from a curated list of sources using Gemini API.
 *
 * @exports synthesizeLesson - The main function to synthesize a lesson.
 */

import { z } from 'zod';
import { generateWithGemini, parseGeminiJson } from '@/lib/gemini';

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
  content: z.string().describe('The full lesson content in Markdown or HTML format, between 800 and 1200 words, with clear sections and practical examples.'),
  sources: z.array(OutputSourceSchema).describe('A curated list of the most reliable sources used for synthesis.'),
  videos: z.array(VideoSchema).describe('A list of relevant videos found in the sources.'),
  estimated_time_min: z.number().describe('Estimated time in minutes to complete the lesson.'),
});
type SynthesizeLessonOutput = z.infer<typeof SynthesizeLessonOutputSchema>;

export async function synthesizeLesson(input: SynthesizeLessonInput): Promise<SynthesizeLessonOutput> {
  const sourcesString = JSON.stringify(input.sources, null, 2);

  const prompt = `You are an expert instructional designer and technical writer. Your task is to synthesize a high-quality, comprehensive, and structured learning lesson from the provided sources about the given topic and phase.

Topic: ${input.topic}
Phase: ${input.phase}
Sources:
${sourcesString}

**Your response MUST follow these instructions:**

1.  **Generate In-Depth, Structured Content:** Create the lesson content ('content') in **Markdown**. It must be between **800 and 1200 words**, well-organized, and include the following sections using appropriate Markdown headings (##, ###):
    *   **Introduction:** Introduce the core concepts, explain their importance, and describe their practical applications.
    *   **Main Body:** Logically break down the topic into several sub-sections. Explain each concept clearly and thoroughly.
        *   Provide **at least 3 practical, real-world examples** to illustrate the concepts.
        *   If applicable, include formulas, tables, or visual descriptions.
    *   **Conclusion:** Summarize the key takeaways and provide specific, actionable practice suggestions or exercises for the learner.

2.  **Estimate Time:** Based on the content length and complexity, provide an 'estimated_time_min' to read and understand the material.

3.  **Write Original, Engaging, and Self-Contained Content:** Do NOT copy content directly from the sources. Synthesize the information in your own words to create a clear, practical, and easy-to-apply lesson. The content must be comprehensive enough for a learner to understand the topic without needing external resources. The tone should be encouraging and accessible but technically accurate.

4.  **Title and Overview:**
    *   Create a concise, descriptive 'title' for the lesson.
    *   Write a short introductory 'overview' (around 50 words) that summarizes the lesson's main points.

5.  **Curate Sources and Videos:**
    *   From the input 'sources' list, select the most relevant and high-quality ones to include in the output 'sources' array. For each, add a 'short_note' explaining its value. Ensure all links are functional.
    *   If any of the sources are videos (especially from YouTube), extract their information and add them to the 'videos' array, including the 'title', original watch 'url', and 'channel' name if possible.

Your final output must be a single, valid JSON object that strictly conforms to the provided output schema.
`;

  const aiText = await generateWithGemini(prompt);
  let output = parseGeminiJson<SynthesizeLessonOutput>(aiText);

  // Post-processing to ensure video data is consistent, if needed.
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
  
  if (output.content.length < 600) {
      console.warn(`[synthesizeLesson] Warning: Generated content is shorter than expected (${output.content.length} words).`);
  }
  
  return SynthesizeLessonOutputSchema.parse(output);
}
