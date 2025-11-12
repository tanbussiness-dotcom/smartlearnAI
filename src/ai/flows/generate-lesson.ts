
'use server';
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';
import { searchSources } from './lesson/search-sources';
import { synthesizeLesson } from './lesson/synthesize-lesson';
import { validateLesson } from './lesson/validate-lesson';

export async function generateLesson(input: any) {
  const { topic, phase, lessonId } = input || {};
  const makeError = (step: string, message: string, details?: any) => ({
    success: false,
    error: { step, message, details: typeof details === 'string' ? details : JSON.stringify(details) },
  });

  console.log('[generateLesson] START', { topic, phase, lessonId });

  try {
    console.log('[generateLesson] STEP searchSources START');
    let sources;
    try {
      const res = await searchSources({ topic, phase });
      console.log('[generateLesson] searchSources result preview:', JSON.stringify(res?.sources?.slice?.(0,3) || []));
      sources = res?.sources || [];
      if (!sources.length) return makeError('searchSources', 'No sources found', res);
    } catch (e:any) {
      console.error('[generateLesson] searchSources ERROR', e?.message || e);
      return makeError('searchSources', e?.message || String(e), e?.stack);
    }
    console.log('[generateLesson] STEP searchSources OK');

    console.log('[generateLesson] STEP synthesizeLesson START');
    let lessonDraft;
    try {
      lessonDraft = await synthesizeLesson({ topic, phase, sources });
      console.log('[generateLesson] synthesizeLesson preview:', typeof lessonDraft === 'object' ? JSON.stringify({ title: lessonDraft.title || null, contentLen: (lessonDraft.content||'').length }) : String(lessonDraft).slice(0,200));
      if (!lessonDraft || !lessonDraft.content) return makeError('synthesizeLesson', 'Empty content', lessonDraft);
    } catch (e:any) {
      console.error('[generateLesson] synthesizeLesson ERROR', e?.message || e);
      return makeError('synthesizeLesson', e?.message || String(e), e?.stack);
    }
    console.log('[generateLesson] STEP synthesizeLesson OK');
    
    // --- Cleanup escaped quotes in content ---
    if (lessonDraft?.content && typeof lessonDraft.content === "string") {
      const c = lessonDraft.content.trim();
      // Detect pattern: starts with \"< or ends with >\"
      if ((c.startsWith('\\"<') && c.endsWith('>\\"')) || (c.startsWith('"') && c.endsWith('"'))) {
        console.warn("[generateLesson] 🧩 Detected escaped content quotes — cleaning up...");
        lessonDraft.content = c
          .replace(/^\\?"?/, "")  // remove leading escaped/double quote
          .replace(/"?\\?$/, "")  // remove trailing escaped/double quote
          .replace(/\\"/g, '"');  // unescape remaining quotes
      }
    }

    console.log('[generateLesson] STEP validateLesson START');
    let validation;
    try {
      validation = await validateLesson({ lessonDraft });
      console.log('[generateLesson] validateLesson result preview:', JSON.stringify(validation).slice(0,1000));
      if (!validation || !validation.valid) return makeError('validateLesson', 'Validation failed', validation);
    } catch (e:any) {
      console.error('[generateLesson] validateLesson ERROR', e?.message || e);
      return makeError('validateLesson', e?.message || String(e), e?.stack);
    }
    console.log('[generateLesson] STEP validateLesson OK');

    console.log('[generateLesson] STEP generateQuizForLesson START');
    let quiz;
    try {
      quiz = await generateQuizForLesson({ lesson_id: lessonId, lesson_content: lessonDraft.content });
      console.log('[generateLesson] generateQuizForLesson preview:', JSON.stringify(quiz).slice(0,500));
      if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) return makeError('generateQuizForLesson', 'No quiz questions generated', quiz);
    } catch (e:any) {
      console.error('[generateLesson] generateQuizForLesson ERROR', e?.message || e);
      return makeError('generateQuizForLesson', e?.message || String(e), e?.stack);
    }
    console.log('[generateLesson] STEP generateQuizForLesson OK');

    // sanitize minimal and return
    const safe = {
      lesson: { title: lessonDraft.title || '', content: lessonDraft.content ? lessonDraft.content.slice(0,2000) : '' },
      validation,
      quiz,
    };
    console.log('[generateLesson] SUCCESS payload preview', JSON.stringify(safe).slice(0,1000));
    return { success: true, data: safe };
  } catch (e:any) {
    console.error('[generateLesson] UNEXPECTED', e?.message || e, e?.stack);
    return makeError('generateLesson', e?.message || 'unexpected', e?.stack);
  }
}
