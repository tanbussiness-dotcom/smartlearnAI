'use server';
/**
 * @fileOverview A test pipeline flow for the lesson generation process.
 *
 * This flow is designed for internal testing and validation. It orchestrates
 * the `generateLesson` flow with a predefined input and then performs basic

 * checks on the output to ensure the pipeline is functioning as expected.
 *
 * It logs the results to the console instead of writing to a database to keep
 * tests self-contained and free of side effects.
 *
 * @exports testLessonPipeline - The main test orchestrator function.
 */

import { ai } from '@/ai/genkit';
import { generateLesson, GenerateLessonOutput } from '@/ai/flows/lesson/generate-lesson';
import { z } from 'zod';

// The output schema for our test results, primarily for logging.
const TestResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  lessonData: GenerateLessonOutput.optional(),
  error: z.string().optional(),
});
type TestResult = z.infer<typeof TestResultSchema>;

export async function testLessonPipeline(): Promise<TestResult> {
  return testLessonPipelineFlow();
}

const testLessonPipelineFlow = ai.defineFlow(
  {
    name: 'testLessonPipelineFlow',
    outputSchema: TestResultSchema,
  },
  async () => {
    console.log('[TEST_PIPELINE] Starting lesson generation test...');

    const testInput = {
      topic: 'Python cơ bản',
      phase: 'Cơ bản',
      userId: 'testUser',
    };

    try {
      // 1. Run the main lesson generation flow
      const lesson = await generateLesson(testInput);
      console.log('[TEST_PIPELINE] `generateLesson` flow completed. Validating output...');

      // 2. Perform validation checks
      if (!lesson) {
        throw new Error('generateLesson returned an undefined or null response.');
      }
      if (!lesson.lesson?.title) {
        throw new Error('Validation failed: Lesson title is missing.');
      }
      if (!lesson.lesson?.synthesized_content) {
        throw new Error('Validation failed: Lesson content is missing.');
      }
      if (!lesson.lesson?.sources || lesson.lesson.sources.length === 0) {
        throw new Error('Validation failed: Lesson sources are missing or empty.');
      }
      // video_links are optional, so we don't fail if they're missing, but we can log it.
      if (!lesson.lesson?.video_links) {
        console.warn('[TEST_PIPELINE] Warning: video_links array is missing.');
      }

      console.log('[TEST_PIPELINE] All checks passed. Lesson is valid.');

      // 3. Log the successful result
      const result: TestResult = {
        success: true,
        message: 'Test pipeline completed successfully.',
        lessonData: lesson,
      };

      console.log('[TEST_PIPELINE] RESULT: \n', JSON.stringify(result, null, 2));
      return result;

    } catch (error: any) {
      console.error('[TEST_PIPELINE] An error occurred during the test:', error);

      // 4. Log the failed result
      const result: TestResult = {
        success: false,
        message: 'Test pipeline failed.',
        error: error.message || 'An unknown error occurred.',
      };

      console.log('[TEST_PIPELINE] FAILED RESULT: \n', JSON.stringify(result, null, 2));
      return result;
    }
  }
);
