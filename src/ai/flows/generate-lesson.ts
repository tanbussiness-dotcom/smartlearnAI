'use server';
/**
 * @fileOverview This is the main orchestrator for the lesson generation process.
 * It coordinates multiple AI steps: searching for sources, synthesizing content,
 * validating the lesson, and generating a quiz. It is designed to be robust,
 * catching errors at each step and returning a structured response to the client.
 *
 * @returns A `GenerateLessonResponse` object:
 *          - `{ success: true, data: { lesson, validation, quiz } }` on success.
 *          - `{ success: false, error: { step, message, details } }` on failure.
 */
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';
import { searchSources } from './lesson/search-sources';
import { synthesizeLesson } from './lesson/synthesize-lesson';
import { validateLesson } from './lesson/validate-lesson';

// Define the shape of the expected input
type GenerateLessonInput = {
  topic: string;
  phase: string;
  lessonId: string;
};

// Define the shape of the structured response
type GenerateLessonResponse =
  | { success: true; data: { lesson: any; validation: any; quiz: any } }
  | { success: false; error: { step: string; message: string; details?: any } };

/**
 * Orchestrates the AI-powered lesson generation process.
 * @param input An object containing the topic, phase, and lesson ID.
 * @returns A promise that resolves to a `GenerateLessonResponse`.
 */
export async function generateLesson(
  input: GenerateLessonInput
): Promise<GenerateLessonResponse> {
  const { topic, phase, lessonId } = input;
  const makeError = (step: string, message: string, details?: any) => ({
    success: false,
    error: { step, message, details: details ? String(details) : 'No details' },
  });

  try {
    console.log('[generateLesson] 🧩 Start for', topic);

    // 1️⃣ Search for relevant sources
    let sources;
    try {
      const res = await searchSources({ topic, phase });
      sources = res?.sources || [];
      if (!sources.length) return makeError('searchSources', 'No sources found', JSON.stringify(res));
      console.log('[generateLesson] ✅ Step OK: searchSources');
    } catch (e: any) {
      console.error('[generateLesson] ❌ Step Failed: searchSources', e);
      return makeError('searchSources', e.message, e.stack);
    }

    // 2️⃣ Synthesize the lesson content from the sources
    let lessonDraft;
    try {
      lessonDraft = await synthesizeLesson({ topic, phase, sources });
       if (!lessonDraft || !lessonDraft.content) {
        return makeError('synthesizeLesson', 'Synthesized content is empty or invalid.', JSON.stringify(lessonDraft));
      }
      console.log('[generateLesson] ✅ Step OK: synthesizeLesson');
    } catch (e: any) {
      console.error('[generateLesson] ❌ Step Failed: synthesizeLesson', e);
      return makeError('synthesizeLesson', e.message, e.stack);
    }

    // 3️⃣ Validate the lesson for quality and accuracy
    let validation;
    try {
      validation = await validateLesson({ lessonDraft });
      if (!validation || !validation.valid)
        return makeError('validateLesson', 'Lesson failed validation', JSON.stringify(validation?.issues || 'No issues reported.'));
      console.log('[generateLesson] ✅ Step OK: validateLesson');
    } catch (e: any) {
      console.error('[generateLesson] ❌ Step Failed: validateLesson', e);
      return makeError('validateLesson', e.message, e.stack);
    }

    // 4️⃣ Generate a quiz to assess knowledge
    let quiz;
    try {
      quiz = await generateQuizForLesson({
        lesson_id: lessonId,
        lesson_content: lessonDraft.content,
      });
       if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        return makeError('generateQuizForLesson', 'Quiz generation returned no questions.', JSON.stringify(quiz));
      }
      console.log('[generateLesson] ✅ Step OK: generateQuizForLesson');
    } catch (e: any) {
      console.error('[generateLesson] ❌ Step Failed: generateQuizForLesson', e);
      return makeError('generateQuizForLesson', e.message, e.stack);
    }

    // ✅ Done: All steps completed successfully.
    console.log('[generateLesson] 🎉 Success!');
    
    const payload = { lesson: lessonDraft, validation, quiz };

    const sanitize = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (obj instanceof Date) return obj.toISOString();
      if (typeof obj === 'object') {
        const o: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v instanceof Error) o[k] = v.message;
          else if (typeof v === 'object' && (v?._path || v?.id)) o[k] = String(v);
          else o[k] = sanitize(v);
        }
        return o;
      }
      return String(obj);
    };

    const safePayload = sanitize(payload);
    console.log('[generateLesson] Final safe payload:', JSON.stringify(safePayload).slice(0, 500));
    return { success: true, data: safePayload };

  } catch (e: any) {
    console.error('[generateLesson] 💥 UNEXPECTED orchestrator error', e);
    return makeError('generateLesson', e.message, e.stack);
  }
}
