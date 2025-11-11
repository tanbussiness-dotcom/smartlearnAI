
'use server';
/**
 * @fileOverview This file defines the orchestrator flow for generating a complete lesson.
 *
 * This flow coordinates multiple sub-flows to perform a sequence of tasks:
 * 1. Search for relevant sources based on a topic and phase.
 * 2. Synthesize a structured lesson from the found sources.
 * 3. Validate the synthesized lesson for quality and accuracy.
 * 4. Generate a quiz for the lesson content.
 * 5. Store the quiz and update the lesson document.
 * The flow then returns the complete lesson object, ready for client-side processing.
 *
 * @exports generateLesson - The main orchestrator function.
 */

import { z } from 'zod';
import { searchSources } from './search-sources';
import { synthesizeLesson } from './synthesize-lesson';
import { validateLesson } from './validate-lesson';
import { generateQuizForLesson } from '../quiz/generate-quiz-for-lesson';
import { SynthesizeLessonOutputSchema, ValidateLessonOutputSchema } from './types';
import { getFirestore, doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { firebaseApp } from '@/firebase/config';

const GenerateLessonInputSchema = z.object({
  topic: z.string().describe('The topic of study (e.g., "React Hooks", "Quantum Physics").'),
  phase: z.string().describe('The learning phase (e.g., "Beginner", "Intermediate", "Advanced").'),
  userId: z.string().describe('The ID of the user requesting the lesson.'),
  topicId: z.string().describe('The Firestore ID of the parent topic.'),
  roadmapId: z.string().describe('The Firestore ID of the parent roadmap step.'),
  lessonId: z.string().describe('The Firestore ID of the lesson document to update.'),
});

// The final output schema, combining synthesis and validation results.
const GenerateLessonOutputSchema = z.object({
  lesson: SynthesizeLessonOutputSchema,
  validation: ValidateLessonOutputSchema,
  created_by: z.string(),
  created_at: z.string().datetime(),
  quizId: z.string().optional(),
});

export async function generateLesson(input: z.infer<typeof GenerateLessonInputSchema>): Promise<z.infer<typeof GenerateLessonOutputSchema>> {
  // Move Firestore initialization inside the function
  const firestore = getFirestore(firebaseApp);
  const { topic, phase, userId, topicId, roadmapId, lessonId } = input;
    
  const lessonRef = doc(firestore, 'users', userId, 'topics', topicId, 'roadmaps', roadmapId, 'lessons', lessonId);

  try {
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

    if (wordCount < 100 || !hasHeadings) {
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

    if (!validationResult.valid) {
      throw new Error(`Lesson validation failed. Issues: ${JSON.stringify(validationResult.issues)}`);
    }

    const lessonPayload = {
      ...lessonDraft,
      status: 'Learning',
      isAiGenerated: true,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    
    // Update the lesson document with the generated content
    await setDoc(lessonRef, lessonPayload, { merge: true });
    console.log(`[generateLesson] Step 4: Saved lesson content to Firestore.`);

    // Step 5: Generate Quiz
    console.log(`[generateLesson] Step 5: Generating quiz for lesson...`);
    const quizResult = await generateQuizForLesson({
        lesson_id: lessonId,
        lesson_content: lessonDraft.content,
    });
    console.log(`[generateLesson] Step 5 COMPLETED: Quiz generated with ${quizResult.questions.length} questions.`);

    // Step 6: Save Quiz to Firestore
    const testsCollectionRef = collection(lessonRef, 'tests');
    const testDocRef = await addDoc(testsCollectionRef, {
        ...quizResult,
        createdBy: userId,
        createdAt: new Date().toISOString(),
    });
    console.log(`[generateLesson] Step 6: Saved quiz to Firestore with ID: ${testDocRef.id}`);

    // Step 7: Update lesson with quiz reference
    await setDoc(lessonRef, {
        quiz_id: testDocRef.id,
        quiz_ready: true,
    }, { merge: true });
    console.log(`[generateLesson] Step 7: Updated lesson with quiz reference.`);

    return {
      lesson: lessonDraft,
      validation: validationResult,
      created_by: userId,
      created_at: lessonPayload.createdAt,
      quizId: testDocRef.id,
    };
  } catch (error: any) {
    console.error(`[generateLesson] CRITICAL FAILURE for user ${userId} on topic "${topic}":`, error);
    try {
        await setDoc(doc(firestore, "aiLogs", Date.now().toString()), {
          userId,
          topic,
          phase,
          error: error.message,
          stack: error.stack,
          time: new Date().toISOString()
        });
    } catch (logError) {
        console.error("[generateLesson] FAILED TO WRITE TO aiLogs:", logError);
    }
    // Re-throw the original error to ensure the client-side knows the operation failed.
    throw error;
  }
}
