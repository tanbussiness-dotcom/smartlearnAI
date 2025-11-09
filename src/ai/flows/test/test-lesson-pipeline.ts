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
import { generateLesson } from '@/ai/flows/lesson/generate-lesson';
import { z } from 'zod';

const OutputSourceSchema = z.object({
    title: z.string().describe("The title of the source."),
    url: z.string().url().describe("The URL of the source."),
    domain: z.string().describe("The domain of the source."),
    type: z.enum(['article', 'doc', 'tutorial', 'video']).describe("The type of content."),
    short_note: z.string().describe("A brief note on why this source is relevant or useful (1-2 sentences)."),
});

const VideoSchema = z.object({
    title: z.string().describe("The title of the video."),
    url: z.string().url().describe("The original YouTube watch URL (not an embed link)."),
    channel: z.string().describe("The name of the YouTube channel, if available."),
});

const SynthesizeLessonOutputSchema = z.object({
  title: z.string().describe('A clear and concise title for the lesson.'),
  overview: z.string().describe('A short introductory paragraph that summarizes the main content of the lesson.'),
  content: z.string().describe('The full lesson content in Markdown or HTML format, between 800 and 1200 words, with clear sections and practical examples.'),
  sources: z.array(OutputSourceSchema).describe('A curated list of the most reliable sources used for synthesis.'),
  videos: z.array(VideoSchema).describe('A list of relevant videos found in the sources.'),
});

const ValidateLessonOutputSchema = z.object({
  valid: z.boolean().describe('A boolean indicating if the lesson is considered valid and ready for use.'),
  confidence_score: z.number().min(0).max(1).describe('A score from 0.0 to 1.0 representing the confidence in the lesson\'s quality.'),
  issues: z.array(
    z.object({
      type: z.string().describe('The type of issue found (e.g., "Factual Error", "Plagiarism Concern", "Clarity").'),
      detail: z.string().describe('A detailed description of the specific issue.'),
    })
  ).describe('A list of issues found in the lesson draft. Empty if the lesson is valid.'),
});

const GenerateLessonOutputSchema = z.object({
  lesson: SynthesizeLessonOutputSchema,
  validation: ValidateLessonOutputSchema,
  created_by: z.string(),
  created_at: z.string().datetime(),
});

// The output schema for our test results, primarily for logging.
const TestResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  lessonData: GenerateLessonOutputSchema.optional(),
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
      if (!lesson.lesson?.content) {
        throw new Error('Validation failed: Lesson content is missing.');
      }
      // Sources are optional, so we don't fail if they're missing
      if (!lesson.lesson?.sources) {
        console.warn('[TEST_PIPELINE] Warning: sources array is missing.');
      }
      // videos are optional, so we don't fail if they're missing, but we can log it.
      if (!lesson.lesson?.videos) {
        console.warn('[TEST_PIPELINE] Warning: videos array is missing.');
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
