
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
  const sourcesString = input.sources && input.sources.length > 0 
    ? JSON.stringify(input.sources.map(s => ({ url: s.url, title: s.title, type: s.type })), null, 2)
    : "No external sources provided. Please generate content based on your own knowledge.";


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
2.  **Structure**: The lesson MUST be well-structured using basic HTML tags for formatting.
    - Start with a Level-1 Heading (<h1>) for a short, clear lesson title.
    - Immediately follow the title with a short, engaging introductory paragraph (<p>).
    - Use Level-2 (<h2>) and Level-3 (<h3>) headings to organize the main body into logical sections.
    - Use paragraphs (<p>), bold (<b> or <strong>), italics (<i> or <em>), and unordered lists (<ul>, <li>).
3.  **Content Details**:
    - The main body of the lesson should be between **800 and 1200 words**.
    - Explain concepts clearly and thoroughly.
    - Include **at least 3 practical, real-world code examples or case studies** inside <pre><code>...</code></pre> blocks.
    - Conclude with a summary of key takeaways and suggest actionable practice exercises for the learner.
4.  **Tone**: The tone should be encouraging, accessible for the learning phase, but technically accurate.

# OUTPUT FORMAT:
- Your response MUST be ONLY the lesson content in pure, raw HTML format.
- DO NOT include any explanations, apologies, or any text other than the HTML content of the lesson itself.
- DO NOT wrap the output in JSON or markdown fences like \`\`\`html.
`;

  const htmlContent = await generateWithGemini(prompt, false);
  console.log('[synthesizeLesson] AI raw preview:', htmlContent.slice(0, 500));


  if (!htmlContent || htmlContent.trim().length < 100) { 
    throw new Error("AI failed to generate any valid lesson content.");
  }
  
  // Extract title and overview from the HTML content
  const titleMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1] : `Bài học về ${input.topic}`;

  const overviewMatch = htmlContent.match(/<p[^>]*>(.*?)<\/p>/i);
  const overview = overviewMatch ? overviewMatch[1] : `Một bài học do AI tạo ra về ${input.topic}.`;

  const wordCount = htmlContent.replace(/<[^>]+>/g, '').split(/\s+/).length;
  const estimatedTimeMin = Math.max(1, Math.round(wordCount / 200));

  let cleanedContent = htmlContent
    .replace(/\\n/g, '\n')
    .replace(/\\\\n/g, '\n')
    .trim();
  
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');

  const finalOutput: SynthesizeLessonOutput = {
    title,
    overview,
    content: cleanedContent,
    estimated_time_min: estimatedTimeMin,
    sources: input.sources ? input.sources.map(s => ({
        ...s,
        short_note: `A resource for learning about ${input.topic}.`
    })) : [],
  };

  return SynthesizeLessonOutputSchema.parse(finalOutput);
}
