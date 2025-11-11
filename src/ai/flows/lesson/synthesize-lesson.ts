
'use server';
/**
 * @fileOverview This file defines the function for synthesizing a structured lesson from a curated list of sources using Gemini API.
 * It now requests only Markdown content from the AI and constructs the final object on the client.
 *
 * @exports synthesizeLesson - The main function to synthesize a lesson.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
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
  const sourcesString = JSON.stringify(input.sources.map(s => ({ url: s.url, title: s.title, type: s.type })), null, 2);

  const prompt = `You are an expert instructional designer and technical writer. Your task is to synthesize a high-quality, comprehensive, and structured learning lesson from the provided sources about the given topic and phase.

Topic: ${input.topic}
Phase: ${input.phase}
Sources (for context):
${sourcesString}

**Your response MUST be ONLY the lesson content in pure Markdown format.**

**Instructions for the Markdown content:**

1.  **Structure:** The lesson must start with a level-1 heading (#) for the title. Immediately following the title, include a short introductory paragraph (this will be the overview).
2.  **Content:** The main body of the lesson should be between **800 and 1200 words**, well-organized, and include the following sections using appropriate Markdown headings (##, ###):
    *   **Introduction:** Introduce the core concepts, explain their importance, and describe their practical applications.
    *   **Main Body:** Logically break down the topic into several sub-sections. Explain each concept clearly and thoroughly.
        *   Provide **at least 3 practical, real-world examples** to illustrate the concepts.
        *   If applicable, include formulas, tables, or visual descriptions.
    *   **Conclusion:** Summarize the key takeaways and provide specific, actionable practice suggestions or exercises for the learner.
3.  **Originality:** Do NOT copy content directly. Synthesize the information in your own words. The tone should be encouraging and accessible but technically accurate.

**Example Format:**
# The Title of The Lesson
This is the short overview paragraph...

## Introduction
...

### Sub-section
...
`;

  const markdownContent = await generateWithGemini(prompt, false);

  if (!markdownContent || markdownContent.trim() === '') {
    throw new Error("AI failed to generate any lesson content.");
  }
  
  // --- Post-processing: Parse the Markdown to build the final object ---
  const lines = markdownContent.split('\n');
  
  // Extract Title (first line, remove '#')
  const title = lines.length > 0 ? lines[0].replace(/^#\s*/, '').trim() : "Untitled Lesson";
  
  // Extract Overview (find the first paragraph after the title)
  let overview = `An AI-generated lesson about ${input.topic}.`;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      overview = lines[i].trim();
      break;
    }
  }

  // Estimate reading time (approx. 200 words per minute)
  const wordCount = markdownContent.split(/\s+/).length;
  const estimatedTimeMin = Math.max(1, Math.round(wordCount / 200));

  const finalOutput: SynthesizeLessonOutput = {
    title,
    overview,
    content: markdownContent, // The full, raw markdown
    estimated_time_min: estimatedTimeMin,
    sources: input.sources.map(s => ({
        ...s,
        short_note: `A resource for learning about ${input.topic}.`
    })),
    videos: input.sources
        .filter(s => s.type === 'video' && s.url)
        .map(s => ({
            title: s.title,
            url: s.url,
            channel: s.domain === 'youtube.com' ? 'YouTube' : s.domain,
        })),
  };

  return SynthesizeLessonOutputSchema.parse(finalOutput);
}
