
'use server';
/**
 * @fileOverview This file defines the function for synthesizing a structured lesson from a curated list of sources using Gemini API.
 * It now requests only Markdown content from the AI and constructs the final object on the client.
 *
 * @exports synthesizeLesson - The main function to synthesize a lesson.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { SynthesizeLessonOutputSchema, OutputSourceSchema as SynthesizeLessonSourceSchema } from './types';

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

  const prompt = `
# ROLE: You are an expert instructional designer and technical writer.

# TASK: Your primary mission is to write a high-quality, comprehensive, and structured learning lesson based on the provided topic, phase, and sources.

# CONTEXT:
- Topic: ${input.topic}
- Learning Phase: ${input.phase}
- Sources (for context and inspiration, do NOT just copy):
${sourcesString}

# INSTRUCTIONS:
1.  **Generate Original Content**: Synthesize the information from the sources and your own knowledge to create an original lesson. DO NOT copy text directly from the sources.
2.  **Structure**: The lesson MUST be well-structured.
    - Start with a Level-1 Heading (#) for the lesson title.
    - Immediately follow the title with a short, engaging introductory paragraph (this will serve as the overview).
    - Use Level-2 (##) and Level-3 (###) headings to organize the main body into logical sections (e.g., Introduction, Core Concepts, Conclusion).
3.  **Content Details**:
    - The main body of the lesson should be between **800 and 1200 words**.
    - Explain concepts clearly and thoroughly.
    - Include **at least 3 practical, real-world code examples or case studies** to illustrate the concepts.
    - Use formatting like bold, italics, lists, and tables where appropriate to improve readability.
    - Conclude with a summary of key takeaways and suggest actionable practice exercises for the learner.
4.  **Tone**: The tone should be encouraging, accessible for the learning phase, but technically accurate.

# OUTPUT FORMAT:
- Your response MUST be ONLY the lesson content in pure, raw Markdown format.
- DO NOT include any explanations, apologies, or any text other than the Markdown content of the lesson itself.

**Example of a valid response:**
# The Title of The Lesson
This is the short overview paragraph...

## Introduction
...

### Core Concept 1
...
`;

  const markdownContent = await generateWithGemini(prompt, false);

  if (!markdownContent || markdownContent.trim().length < 100) { // Increased minimum length check
    throw new Error("AI failed to generate any valid lesson content.");
  }
  
  // --- Post-processing: Parse the Markdown to build the final object ---
  const lines = markdownContent.split('\n');
  
  // Extract Title (first line, remove '#')
  const title = lines.length > 0 ? lines[0].replace(/^#\s*/, '').trim() : "Untitled Lesson";
  
  // Extract Overview (find the first paragraph after the title)
  let overview = `An AI-generated lesson about ${input.topic}.`;
  for (let i = 1; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    // Ensure the overview is not another heading
    if (trimmedLine !== '' && !trimmedLine.startsWith('#')) {
      overview = trimmedLine;
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
