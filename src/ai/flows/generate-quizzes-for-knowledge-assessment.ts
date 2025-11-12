
'use server';

/**
 * @fileOverview Generates quizzes for knowledge assessment based on detailed lesson content using Gemini API.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';
import { GenerateQuizForLessonOutputSchema } from './lesson/types';

const GenerateQuizForLessonInputSchema = z.object({
  lesson_id: z.string().describe('The ID of the lesson to generate a quiz for.'),
  lesson_content: z.string().describe('The detailed content of the lesson to generate questions from.'),
});
export type GenerateQuizForLessonInput = z.infer<typeof GenerateQuizForLessonInputSchema>;
export type GenerateQuizForLessonOutput = z.infer<typeof GenerateQuizForLessonOutputSchema>;

export async function generateQuizForLesson(input: GenerateQuizForLessonInput): Promise<GenerateQuizForLessonOutput> {
  const prompt = `You are an expert quiz creator for educational material. Your task is to generate a multiple-choice quiz with up to 5 questions based *only* on the provided lesson content.

**Instructions:**
1.  Read the entire 'lesson_content' provided below.
2.  Create up to 5 questions that directly test the core knowledge within the lesson.
3.  For each question, provide:
    - A clear and unambiguous 'question'.
    - An array of 4 'options'.
    - The 'correct_answer' which must be one of the provided options.
    - A detailed 'explanation' that clarifies why the answer is correct and why the others are not, referencing concepts from the lesson content.
4.  All terminology, definitions, and examples used in the questions and explanations must align with the provided 'lesson_content'. Do not introduce external information.
5.  The final output must be a single, valid JSON object conforming to the specified schema, including the 'lesson_id' from the input and a default 'pass_score' of 80.

**Lesson Content:**
'''
${input.lesson_content}
'''
`;

  try {
    const aiText = await generateWithGemini(prompt, false);
    console.log('[generateQuizForLesson] AI raw preview:', aiText.slice(0, 500));

    let result: any;
    try {
      result = parseGeminiJson(aiText);
    } catch (err: any) {
      console.warn('[generateQuizForLesson] ⚠️ parseGeminiJson failed:', err.message);
      result = {};
    }

    // --- Defensive normalization BEFORE schema validation ---
    if (!result || typeof result !== 'object') result = {};
    if (!Array.isArray(result.questions)) {
      console.warn('[generateQuizForLesson] ⚠️ Missing "questions" array, injecting empty.');
      result.questions = [];
    }
    
    const finalOutput = {
      lesson_id: input.lesson_id,
      title: result.title || `Quiz for ${input.lesson_id}`,
      questions: result.questions,
      pass_score: result.pass_score || 80,
    };

    const parsed = GenerateQuizForLessonOutputSchema.safeParse(finalOutput);

    if (!parsed.success) {
      console.error('[generateQuizForLesson] ⚠️ Schema validation failed:', parsed.error.format());

      // ✅ Always return schema-compliant fallback
      return {
        lesson_id: input.lesson_id || 'unknown-lesson',
        title: `Fallback Quiz for ${input.lesson_id || 'unknown'}`,
        questions: [
          {
            question: 'What is the main topic of this lesson?',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 'A',
            explanation: 'This is a placeholder quiz since AI quiz generation failed.',
          },
        ],
        pass_score: 80,
      };
    }

    console.log('[generateQuizForLesson] ✅ Quiz validated and returned successfully.');
    return parsed.data;

  } catch (err: any) {
    console.error('[generateQuizForLesson] ❌ Unexpected fatal error:', err?.message || err);

    // ✅ Guaranteed fallback (never throws to frontend)
    return {
      lesson_id: input.lesson_id || 'unknown-lesson',
      title: 'Quiz Generation Error',
      questions: [
        {
          question: 'AI quiz generation encountered an error. Please retry later.',
          options: ['Okay', 'Got it', 'Retry', 'Skip'],
          correct_answer: 'Okay',
          explanation: 'Fallback placeholder question to avoid frontend crash.',
        },
      ],
      pass_score: 80,
    };
  }
}
