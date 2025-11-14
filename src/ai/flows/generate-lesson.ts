
'use server';

import { searchSources } from './lesson/search-sources';
import { synthesizeLesson } from './lesson/synthesize-lesson';
import { validateLesson } from './lesson/validate-lesson';
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';

export async function generateLesson(input:any) {
  const log = (msg:string) => console.log(`[🧠 generateLesson] ${msg}`);

  const measure = async (label:string, fn: () => Promise<any>) => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      log(`✅ ${label} completed in ${duration}ms`);
      return { result, duration };
    } catch (err:any) {
      const duration = Date.now() - start;
      log(`❌ ${label} failed after ${duration}ms: ${err.message}`);
      throw err;
    }
  };

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    log(`🚀 Attempt ${attempt}/${MAX_ATTEMPTS} started for topic "${input.topic}"`);

    try {
      // Phase 1: Search Sources
      const { result: sources, duration: t1 } = await measure('Search Sources', () =>
        searchSources(input)
      );

      // Phase 2: Synthesize Lesson
      const { result: lesson, duration: t2 } = await measure('Synthesize Lesson', () =>
        synthesizeLesson({
          topic: input.topic,
          phase: input.phase,
          sources: sources?.sources || [],
        })
      );

      // Phase 3: Validate Lesson
      const { result: validation, duration: t3 } = await measure('Validate Lesson', () =>
        validateLesson({ lessonDraft: lesson })
      );

      // Phase 4: Generate Quiz
      let quiz: any = null;
      let t4 = 0;
      try {
        const { result: q, duration: quizDuration } = await measure('Generate Quiz', () =>
          generateQuizForLesson({
            lesson_id: lesson.title,
            lesson_content: lesson.content,
          })
        );
        t4 = quizDuration;
      
        if (!q || !Array.isArray(q.questions) || q.questions.length === 0) {
          console.warn('⚠️ Quiz generation returned empty.');
          quiz = { lesson_id: lesson.title, questions: [] };
        } else {
          quiz = q;
        }
      } catch (err: any) {
        console.error('❌ Quiz generation error:', err);
        quiz = { lesson_id: lesson.title, questions: [] };
      }


      const totalMs = t1 + t2 + t3 + t4;

      const summary = {
        status: 'success',
        topic: input.topic,
        phase: input.phase,
        timings: {
          search_ms: t1,
          synthesize_ms: t2,
          validate_ms: t3,
          quiz_ms: t4,
          total_ms: totalMs,
        },
        lesson,
        validation,
        quiz,
      };

      log(`🎯 Lesson generation success in ${totalMs}ms`);
      console.table(summary.timings);
      return summary;
    } catch (err:any) {
      log(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        log('Retrying in 2 seconds...');
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      } else {
        log('❌ All attempts failed.');
        return {
          status: 'error',
          topic: input.topic,
          phase: input.phase,
          error: err.message,
          lesson: null,
          validation: null,
          quiz: null,
        };
      }
    }
  }
}
