'use server';
/**
 * @fileOverview This file defines the orchestrator flow for generating a complete lesson.
 *
 * This flow coordinates multiple sub-flows to perform a sequence of tasks:
 * 1. Search for relevant sources based on a topic and phase.
 * 2. Synthesize a structured lesson from the found sources.
 * 3. Validate the synthesized lesson for quality and accuracy.
 * The flow then returns the complete lesson object, ready for client-side processing,
 * such as saving to a database.
 *
 * @exports generateLesson - The main orchestrator function.
 * @exports GenerateLessonInput - The input type for the generateLesson function.
 * @exports GenerateLessonOutput - The output type for the generateLesson function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

import {searchSources, SearchSourcesInputSchema} from './search-sources';
import {synthesizeLesson} from './synthesize-lesson';
import {validateLesson, ValidateLessonOutputSchema} from './validate-lesson';
import {SynthesizeLessonOutputSchema} from './synthesize-lesson';

// Input schema for the orchestrator flow.
export const GenerateLessonInputSchema = SearchSourcesInputSchema.extend({
  userId: z.string().describe('The ID of the user requesting the lesson.'),
});
export type GenerateLessonInput = z.infer<typeof GenerateLessonInputSchema>;

// The final output schema, combining synthesis and validation results.
export const GenerateLessonOutputSchema = z.object({
  lesson: SynthesizeLessonOutputSchema,
  validation: ValidateLessonOutputSchema,
  created_by: z.string(),
  created_at: z.string().datetime(),
});
export type GenerateLessonOutput = z.infer<typeof GenerateLessonOutputSchema>;

export async function generateLesson(input: GenerateLessonInput): Promise<GenerateLessonOutput> {
  return generateLessonFlow(input);
}

const generateLessonFlow = ai.defineFlow(
  {
    name: 'generateLessonFlow',
    inputSchema: GenerateLessonInputSchema,
    outputSchema: GenerateLessonOutputSchema,
  },
  async (input) => {
    const { topic, phase, userId } = input;

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


    // Step 3: Validate the synthesized lesson
    console.log('[generateLesson] Step 3: Validating lesson...');
    const validationResult = await validateLesson({ lessonDraft });
    console.log(`[generateLesson] Step 3 COMPLETED: Validation result: ${validationResult.valid} (Confidence: ${validationResult.confidence_score})`);

    // Step 4: Prepare the final lesson object for the client to save
    // The actual saving logic will be handled on the client-side to keep
    // AI flows focused on generation and validation.

    return {
      lesson: lessonDraft,
      validation: validationResult,
      created_by: userId,
      created_at: new Date().toISOString(),
    };
  }
);
