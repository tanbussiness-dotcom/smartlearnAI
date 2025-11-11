'use server';
/**
 * Orchestrator: generateLesson
 * Returns structured JSON: { success: true, data: { lesson, validation, quiz } }
 * or { success: false, error: { code, step, message, details } }
 */
import { z } from 'zod';
import { searchSources } from './search-sources';
import { synthesizeLesson } from './synthesize-lesson';
import { validateLesson } from './validate-lesson';
import { generateQuizForLesson } from '../generate-quizzes-for-knowledge-assessment';
import { 
  SynthesizeLessonOutputSchema, 
  ValidateLessonOutputSchema, 
  GenerateQuizForLessonOutputSchema 
} from './types';

const GenerateLessonInputSchema = z.object({
  topic: z.string(),
  phase: z.string(),
  lessonId: z.string().optional(),
});

export type GenerateLessonResponse =
  | { success: true; data: { lesson: any; validation: any; quiz: any } }
  | { success: false; error: { code: string; step: string; message: string; details?: string } };

export async function generateLesson(input: z.infer<typeof GenerateLessonInputSchema>): Promise<GenerateLessonResponse> {
  const { topic, phase, lessonId } = input;

  // Step helper for consistent error returns
  const err = (code: string, step: string, message: string, details?: string): GenerateLessonResponse => ({
    success: false,
    error: { code, step, message, details },
  });

  try {
    // STEP 1 - search sources
    let searchResult;
    try {
      searchResult = await searchSources({ topic, phase });
      if (!searchResult || !Array.isArray(searchResult.sources) || searchResult.sources.length === 0) {
        return err('NO_SOURCES', 'searchSources', 'No relevant sources found', JSON.stringify(searchResult));
      }
    } catch (e: any) {
      console.error('[generateLesson] searchSources error:', e);
      return err('SEARCH_FAILED', 'searchSources', e?.message || String(e), e?.stack);
    }

    // STEP 2 - synthesize
    let lessonDraft;
    try {
      lessonDraft = await synthesizeLesson({ topic, phase, sources: searchResult.sources });
      if (!lessonDraft || !lessonDraft.content || typeof lessonDraft.content !== 'string') {
        return err('SYNTHESIS_INVALID', 'synthesizeLesson', 'Synthesis returned invalid content', JSON.stringify(lessonDraft));
      }
    } catch (e: any) {
      console.error('[generateLesson] synthesizeLesson error:', e);
      return err('SYNTHESIS_FAILED', 'synthesizeLesson', e?.message || String(e), e?.stack);
    }

    // STEP 3 - validate
    let validationResult;
    try {
      validationResult = await validateLesson({ lessonDraft });
      if (!validationResult || typeof validationResult.valid !== 'boolean') {
        return err('VALIDATION_INVALID', 'validateLesson', 'Validation returned unexpected result', JSON.stringify(validationResult));
      }
      if (!validationResult.valid) {
        // Return lesson content along with validation issues so UI can show them and allow manual accept/retry
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            step: 'validateLesson',
            message: 'Lesson failed validation',
            details: JSON.stringify(validationResult.issues || []),
          },
        };
      }
    } catch (e: any) {
      console.error('[generateLesson] validateLesson error:', e);
      return err('VALIDATION_ERROR', 'validateLesson', e?.message || String(e), e?.stack);
    }

    // STEP 4 - generate quiz
    let quizResult;
    try {
      quizResult = await generateQuizForLesson({
        lesson_id: lessonId || '',
        lesson_content: lessonDraft.content,
      });
      if (!quizResult) {
        return err('QUIZ_INVALID', 'generateQuizForLesson', 'Quiz generator returned empty result', JSON.stringify(quizResult));
      }
    } catch (e: any) {
      console.error('[generateLesson] generateQuizForLesson error:', e);
      return err('QUIZ_FAILED', 'generateQuizForLesson', e?.message || String(e), e?.stack);
    }

    // Final success
    return {
      success: true,
      data: {
        lesson: lessonDraft,
        validation: validationResult,
        quiz: quizResult,
      },
    };

  } catch (e: any) {
    // Unexpected top-level error: log and return structured error
    console.error('[generateLesson] UNEXPECTED ERROR', e);
    return {
      success: false,
      error: {
        code: 'UNEXPECTED',
        step: 'generateLesson',
        message: e?.message || 'Unexpected error',
        details: e?.stack,
      },
    };
  }
}
