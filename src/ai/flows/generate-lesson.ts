'use server';
import { synthesizeLesson } from './synthesize-lesson';
import { validateLesson } from './validate-lesson';
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';
import { searchSources } from './search-sources';

export async function generateLesson(input: { topic: string; phase: string; lessonId: string; }) {
  const { topic, phase, lessonId } = input;
  const makeError = (step: string, message: string, details?: any) => ({
    success: false,
    error: { step, message, details: details ? String(details) : 'No details' },
  });

  try {
    console.log('[generateLesson] 🧩 Start for', topic);

    // 1️⃣ Search sources
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

    // 2️⃣ Synthesize
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

    // 3️⃣ Validate
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

    // 4️⃣ Quiz generation
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

    // ✅ Done
    console.log('[generateLesson] 🎉 Success!');
    
    // Before returning success, sanitize payload to ensure serializable structure
    const payload = {
      lesson: lessonDraft,
      validation,
      quiz,
    };

    let safePayload: any;
    try {
      JSON.stringify(payload); // test serialization
      safePayload = payload;
    } catch (err) {
      console.warn('[generateLesson] Payload not serializable, sanitizing...');
      const sanitize = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        const out: any = Array.isArray(obj) ? [] : {};
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (val instanceof Date) out[key] = val.toISOString();
          else if (typeof val === 'object' && (val._path || val.id || val._key)) {
            try {
              out[key] = JSON.stringify(val);
            } catch {
              out[key] = String(val);
            }
          } else if (typeof val === 'object') out[key] = sanitize(val);
          else out[key] = val;
        }
        return out;
      };
      safePayload = sanitize(payload);
    }

    console.log('[generateLesson] Safe payload preview:', JSON.stringify(safePayload).slice(0, 800));

    return { success: true, data: safePayload };

  } catch (e: any) {
    console.error('[generateLesson] 💥 UNEXPECTED orchestrator error', e);
    return makeError('generateLesson', e.message, e.stack);
  }
}
