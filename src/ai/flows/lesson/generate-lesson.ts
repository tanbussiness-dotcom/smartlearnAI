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
import { getFirestore, collectionGroup, query, where, limit, getDocs } from 'firebase/firestore';


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
    
    // Caching logic: Check if a similar lesson already exists and is ready.
    // This uses a collectionGroup query, which requires a Firestore index.
    // The index to create is: collection: 'lessons', fields: 'topic' (asc), 'phase' (asc), 'status' (asc).
    const firestore = getFirestore();
    const lessonsRef = collectionGroup(firestore, 'lessons');
    const cacheQuery = query(
      lessonsRef,
      where('topic', '==', topic),
      where('phase', '==', phase),
      where('status', '==', 'ready'),
      limit(1)
    );

    const cachedSnapshot = await getDocs(cacheQuery);
    if (!cachedSnapshot.empty) {
      console.log(`[generateLesson] Step 0: Found cached lesson for topic "${topic}"`);
      const cachedData = cachedSnapshot.docs[0].data();
      // Reconstruct the output to match the flow's schema, updating user and timestamp
      return {
        lesson: {
            title: cachedData.title,
            overview: cachedData.overview,
            content: cachedData.content,
            sources: cachedData.sources,
            videos: cachedData.videos,
        },
        validation: { // Assume cached lessons are valid
            valid: true,
            confidence_score: 1.0,
            issues: [],
        },
        created_by: userId, // Attribute to the current user
        created_at: new Date().toISOString(), // Set a new creation date
      };
    }


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

    if (wordCount < 800 || !hasHeadings) {
        let feedback = `Validation failed: `;
        if (wordCount < 800) feedback += `Content is too short (${wordCount} words). `;
        if (!hasHeadings) feedback += `Content is missing proper section headings (## or ###). `;
        
        console.error(`[generateLesson] Step 2.5 FAILED: ${feedback}`);
        throw new Error(feedback);
    }
    console.log(`[generateLesson] Step 2.5 COMPLETED: Basic checks passed (Words: ${wordCount}, Headings: ${hasHeadings}).`);


    // Step 3: Validate the synthesized lesson using AI
    console.log('[generateLesson] Step 3: Validating lesson with AI...');
    const validationResult = await validateLesson({ lessonDraft });
    console.log(`[generateLesson] Step 3 COMPLETED: Validation result: ${validationResult.valid} (Confidence: ${validationResult.confidence_score})`);

    // The actual saving logic is handled on the client-side after this flow returns.
    // The returned object will be saved to the user's specific lesson document.
    // If it's a new lesson, it effectively populates our cache for future users.
    return {
      lesson: lessonDraft,
      validation: validationResult,
      created_by: userId,
      created_at: new Date().toISOString(),
    };
  }
);
