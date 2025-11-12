
'use server';
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';
import { searchSources } from './lesson/search-sources';
import { synthesizeLesson } from './lesson/synthesize-lesson';
import { validateLesson } from './lesson/validate-lesson';

const MAX_STRING = 5000;

// --- Helper to safely serialize any object before return ---
function safeJSON(obj: any): any {
  try {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') return obj.slice(0, MAX_STRING);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(safeJSON);
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'function' || typeof v === 'symbol' || v === undefined) continue;
      clean[k] = safeJSON(v);
    }
    return clean;
  } catch {
    return '[Unserializable data]';
  }
}

const makeError = (step: string, message: string, details?: any) => ({
  success: false,
  error: safeJSON({
    step,
    message,
    details: typeof details === 'string' ? details.slice(0, MAX_STRING) : safeJSON(details),
  }),
});


export async function generateLesson(input: any) {
  const { topic, phase, lessonId } = input || {};
  
  console.log('[generateLesson] START', { topic, phase, lessonId });

  let sources;
  try {
    console.log('[generateLesson] STEP searchSources START');
    const res = await searchSources({ topic, phase });
    console.log('[generateLesson] searchSources result preview:', JSON.stringify(res?.sources?.slice?.(0,3) || []));
    sources = res?.sources || [];
    if (!sources.length) return makeError('searchSources', 'No sources found', res);
    console.log('[generateLesson] STEP searchSources OK');
  } catch (e:any) {
    console.error('[generateLesson] searchSources ERROR', e?.message || e);
    return makeError('searchSources', e?.message || String(e), e?.stack);
  }

  let lessonDraft;
  try {
    console.log('[generateLesson] STEP synthesizeLesson START');
    lessonDraft = await synthesizeLesson({ topic, phase, sources });
    console.log('[generateLesson] synthesizeLesson preview:', typeof lessonDraft === 'object' ? JSON.stringify({ title: lessonDraft.title || null, contentLen: (lessonDraft.content||'').length }) : String(lessonDraft).slice(0,200));
    if (!lessonDraft || !lessonDraft.content) return makeError('synthesizeLesson', 'Empty content', lessonDraft);
    console.log('[generateLesson] STEP synthesizeLesson OK');
  } catch (e:any) {
    console.error('[generateLesson] synthesizeLesson ERROR', e?.message || e);
    return makeError('synthesizeLesson', e?.message || String(e), e?.stack);
  }
  
  // --- Cleanup escaped quotes in content ---
  if (lessonDraft?.content && typeof lessonDraft.content === "string") {
    const c = lessonDraft.content.trim();
    if ((c.startsWith('\\"<') && c.endsWith('>\\"')) || (c.startsWith('"') && c.endsWith('"'))) {
      console.warn("[generateLesson] 🧩 Detected escaped content quotes — cleaning up...");
      lessonDraft.content = c
        .replace(/^\\?"?/, "")
        .replace(/"?\\?$/, "")
        .replace(/\\"/g, '"');
    }
  }

  let validation;
  try {
    console.log('[generateLesson] STEP validateLesson START');
    validation = await validateLesson({ lessonDraft });
    console.log('[generateLesson] validateLesson result preview:', JSON.stringify(validation).slice(0,1000));
    if (!validation || !validation.valid) return makeError('validateLesson', 'Validation failed', validation);
    console.log('[generateLesson] STEP validateLesson OK');
  } catch (e:any) {
    console.error('[generateLesson] validateLesson ERROR', e?.message || e);
    return makeError('validateLesson', e?.message || String(e), e?.stack);
  }

  let quiz;
  try {
    console.log('[generateLesson] STEP generateQuizForLesson START');
    quiz = await generateQuizForLesson({ lesson_id: lessonId, lesson_content: lessonDraft.content });
    console.log('[generateLesson] generateQuizForLesson preview:', JSON.stringify(quiz).slice(0,500));
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) return makeError('generateQuizForLesson', 'No quiz questions generated', quiz);
    console.log('[generateLesson] STEP generateQuizForLesson OK');
  } catch (e:any) {
    console.error('[generateLesson] generateQuizForLesson ERROR', e?.message || e);
    return makeError('generateQuizForLesson', e?.message || String(e), e?.stack);
  }

  try {
    const sanitized = safeJSON({
      lesson: { title: lessonDraft?.title || '', content: (lessonDraft?.content || '').slice(0, MAX_STRING) },
      validation: safeJSON(validation),
      quiz: safeJSON(quiz),
    });

    console.log('[generateLesson] ✅ Sanitized payload length:', JSON.stringify(sanitized).length);
    return { success: true, data: sanitized };

  } catch (err: any) {
    console.error('[generateLesson] FINAL SERIALIZATION ERROR', err?.message);
    return {
      success: false,
      error: {
        step: 'serialization',
        message: err?.message || 'Failed to serialize server action result',
      },
    };
  }
}
