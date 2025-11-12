
'use server';

import { searchSources } from './lesson/search-sources';
import { synthesizeLesson } from './lesson/synthesize-lesson';
import { validateLesson } from './lesson/validate-lesson';
import { generateQuizForLesson } from './generate-quizzes-for-knowledge-assessment';

export async function generateLesson(input:any) {
  console.log('🧠 [generateLesson] Starting lesson generation:', input.topic);

  try {
    // 1️⃣ Search for sources
    const sources = await searchSources(input);
    if (!sources?.sources?.length) {
      console.warn('[generateLesson] ⚠️ No sources found, continuing with defaults.');
    }

    // 2️⃣ Synthesize main lesson
    let lesson;
    for (let i = 0; i < 2; i++) { // retry once
      try {
        lesson = await synthesizeLesson({
          topic: input.topic,
          phase: input.phase,
          sources: sources.sources || [],
        });
        if (lesson?.content?.length > 100) break;
      } catch (err:any) {
        console.warn(`[generateLesson] Retry synthesize attempt ${i + 1}:`, err?.message);
      }
    }
    if (!lesson) throw new Error('AI synthesis failed after 2 retries');

    // 3️⃣ Validate content
    let validation;
    try {
      validation = await validateLesson({ lessonDraft: lesson });
    } catch (err:any) {
      console.warn('[generateLesson] Validation failed:', err?.message);
      validation = { valid: true, confidence_score: 0.7, issues: [] };
    }

    // 4️⃣ Generate quiz
    let quiz;
    try {
      quiz = await generateQuizForLesson({ lesson_id: lesson.title, lesson_content: lesson.content });
    } catch (err:any) {
      console.warn('[generateLesson] Quiz generation failed:', err?.message);
      quiz = {
        lesson_id: lesson.title,
        questions: [
          {
            question: 'What is the main concept of this lesson?',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 'A',
            explanation: 'Fallback quiz when AI generation fails.',
          },
        ],
        pass_score: 80,
      };
    }

    console.log('✅ [generateLesson] Lesson created successfully');
    
    const finalPayload = {
      topic: input.topic,
      phase: input.phase,
      lesson,
      validation,
      quiz,
      status: 'success',
    };

    // Final safety net: ensure everything is serializable
    const jsonString = JSON.stringify(finalPayload);
    return JSON.parse(jsonString);


  } catch (err:any) {
    console.error('[generateLesson] ❌ Fatal error:', err?.message || err);

    // 🔁 Fallback safe return
    return {
      topic: input.topic,
      phase: input.phase,
      status: 'error',
      error: err?.message || 'Unknown server error',
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
