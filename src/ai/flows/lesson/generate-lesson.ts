
'use server';
/**
 * @fileOverview This file defines the orchestrator flow for generating a complete lesson.
 *
 * This flow coordinates multiple sub-flows to perform a sequence of tasks:
 * 1. Search for relevant sources based on a topic and phase.
 * 2. Synthesize a structured lesson from the found sources.
 * 3. Validate the synthesized lesson for quality and accuracy.
 * The flow then returns the complete lesson object, ready for client-side processing.
 *
 * @exports generateLesson - The main orchestrator function.
 */

import { z } from 'zod';
import { searchSources, SearchSourcesOutputSchema } from './search-sources';
import { synthesizeLesson, SynthesizeLessonOutputSchema } from './synthesize-lesson';
import { validateLesson, ValidateLessonOutputSchema } from './validate-lesson';

const GenerateLessonInputSchema = z.object({
  topic: z.string().describe('The topic of study (e.g., "React Hooks", "Quantum Physics").'),
  phase: z.string().describe('The learning phase (e.g., "Beginner", "Intermediate", "Advanced").'),
  userId: z.string().describe('The ID of the user requesting the lesson.'),
});

// The final output schema, combining synthesis and validation results.
const GenerateLessonOutputSchema = z.object({
  lesson: SynthesizeLessonOutputSchema,
  validation: ValidateLessonOutputSchema,
  created_by: z.string(),
  created_at: z.string().datetime(),
});

export async function generateLesson(input: z.infer<typeof GenerateLessonInputSchema>): Promise<z.infer<typeof GenerateLessonOutputSchema>> {
  const { topic, phase, userId } = input;
    
  // NOTE: Caching logic has been removed as it relied on server-side Firestore queries which are no longer part of this architecture.
  // Caching can be re-implemented at the API-calling layer (`generateWithGemini`) if needed.

  // Step 1: Search for sources
  console.log(`[generateLesson] Step 1: Searching sources for topic: "${topic}"`);
  const searchResult = await searchSources({ topic, phase });
  if (!searchResult.sources || searchResult.sources.length === 0) {
    console.error('[generateLesson] Step 1 FAILED: No sources found.');
    throw new Error('Could not find any relevant sources for the topic.');
  }
  console.log(`[generateLesson] Step 1 COMPLETED: Found ${searchResult.sources.length} sources.`);

  // Step 2: Synthesize the lesson from the sources
  console.log('[generateLesson] Step 2: Synthesizing lesson...');
  const lessonDraft = await synthesizeLesson({
    topic,
    phase,
    sources: searchResult.sources,
  });
  console.log('[generateLesson] Step 2 COMPLETED: Lesson draft created.');

  // Step 2.5: Basic content validation before calling the validation AI
  console.log('[generateLesson] Step 2.5: Performing basic validation...');
  const wordCount = lessonDraft.content.split(/\s+/).length;
  const hasHeadings = /^(##|###) /m.test(lessonDraft.content);

  if (wordCount < 100 || !hasHeadings) { // Reduced word count threshold for flexibility
      let feedback = `Validation failed: `;
      if (wordCount < 100) feedback += `Content is too short (${wordCount} words). `;
      if (!hasHeadings) feedback += `Content is missing proper section headings (## or ###). `;
      
      console.error(`[generateLesson] Step 2.5 FAILED: ${feedback}`);
      throw new Error(feedback);
  }
  console.log(`[generateLesson] Step 2.5 COMPLETED: Basic checks passed (Words: ${wordCount}, Headings: ${hasHeadings}).`);

  // Step 3: Validate the synthesized lesson using AI
  console.log('[generateLesson] Step 3: Validating lesson with AI...');
  const validationResult = await validateLesson({ lessonDraft });
  console.log(`[generateLesson] Step 3 COMPLETED: Validation result: ${validationResult.valid} (Confidence: ${validationResult.confidence_score})`);

  return {
    lesson: lessonDraft,
    validation: validationResult,
    created_by: userId,
    created_at: new Date().toISOString(),
  };
}
