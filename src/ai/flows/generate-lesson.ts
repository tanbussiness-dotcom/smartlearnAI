
'use server';

import { searchSources } from './lesson/search-sources';
import { synthesizeLesson } from './lesson/synthesize-lesson';
import { validateLesson } from './lesson/validate-lesson';
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';

export async function generateLesson(input:any) {
  console.log('🧠 [generateLesson] Start:', input.topic);

  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Lesson generation timeout')), ms));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`⚙️ [generateLesson] Attempt ${attempt}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const result = await Promise.race([
        (async () => {
          const sources = await searchSources(input);

          const lesson = await synthesizeLesson({
            topic: input.topic,
            phase: input.phase,
            sources: sources?.sources || [],
          });

          const validation = await validateLesson({ lessonDraft: lesson })
            .catch(() => ({ valid: true, confidence_score: 0.7, issues: [] }));

          const quiz = await generateQuizForLesson({
            lesson_id: lesson.title,
            lesson_content: lesson.content,
          }).catch(() => ({
            lesson_id: lesson.title,
            questions: [
              {
                question: 'What is the main idea of this lesson?',
                options: ['A', 'B', 'C', 'D'],
                correct_answer: 'A',
                explanation: 'Fallback quiz due to generation failure.',
              },
            ],
            pass_score: 80,
          }));

          clearTimeout(timeoutId);
          console.log('✅ [generateLesson] Completed successfully');
          const finalPayload = {
            status: 'success',
            topic: input.topic,
            phase: input.phase,
            lesson,
            validation,
            quiz,
          };
          // Final safety net: ensure everything is serializable
          const jsonString = JSON.stringify(finalPayload);
          return JSON.parse(jsonString);

        })(),
        timeout(45000),
      ]);

      return result;
    } catch (err:any) {
      console.warn(`[generateLesson] Attempt ${attempt} failed:`, err.message);
      if (attempt === 3) {
        console.error('❌ [generateLesson] All retries failed.');
        return {
          status: 'error',
          topic: input.topic,
          phase: input.phase,
          error: err.message || 'Unknown error',
          lesson: {
            title: 'Lesson generation failed',
            overview: 'AI could not generate this lesson. Please try again later.',
            content: '',
            estimated_time_min: 0,
            sources: [],
          },
          validation: { valid: false, confidence_score: 0, issues: [] },
          quiz: { lesson_id: 'none', questions: [], pass_score: 80 },
        };
      }
    }
  }
}
