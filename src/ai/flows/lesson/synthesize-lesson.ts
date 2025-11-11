
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

  // Ensure the core content exists. If not, throw an error.
  if (!output || !output.content) {
      throw new Error("Failed to generate a valid lesson structure from AI. The 'content' field is missing.");
  }
  
  // Safely initialize sources and videos if they are missing from the AI response
  if (!output.sources) {
    output.sources = [];
  }
  if (!output.videos) {
    output.videos = [];
  }

  // Post-processing to fix missing fields from the AI's curated sources list.
  const inputSourcesByUrl = new Map(input.sources.map(s => [s.url, s]));
  output.sources = output.sources.map(source => {
    // Ensure we don't crash if AI returns a source without a URL
    if (!source || !source.url) return source; 
    const originalSource = inputSourcesByUrl.get(source.url);
    if (originalSource) {
        // Ensure all required fields from the original source are present if missing in the AI output.
        return {
            ...originalSource, // Start with all original data
            ...source,          // Override with what the AI provided (like short_note)
        };
    }
    return source; 
  }).filter(Boolean); // Remove any null/undefined entries

  // Post-processing to ensure video data is consistent, if needed.
  const videoSources = output.sources.filter(s => s.type === 'video');
  // Ensure output.videos is an array before trying to map it
  const existingVideoUrls = new Set((output.videos || []).filter(v => v && v.url).map(v => v.url));

  for (const videoSource of videoSources) {
      if (videoSource.url && !existingVideoUrls.has(videoSource.url)) {
          output.videos.push({
              title: videoSource.title,
              url: videoSource.url,
              channel: videoSource.domain === 'youtube.com' ? 'YouTube' : videoSource.domain,
          });
          existingVideoUrls.add(videoSource.url);
      }
  }
  
  return SynthesizeLessonOutputSchema.parse(output);
}
