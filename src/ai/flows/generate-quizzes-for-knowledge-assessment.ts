
'use server';

/**
 * @fileOverview Generates quizzes for knowledge assessment based on detailed lesson content using Gemini API.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';

const GenerateQuizForLessonInputSchema = z.object({
  lesson_id: z.string().describe('The ID of the lesson to generate a quiz for.'),
  lesson_content: z.string().describe('The detailed content of the lesson to generate questions from.'),
});
export type GenerateQuizForLessonInput = z.infer<typeof GenerateQuizForLessonInputSchema>;

const QuestionSchema = z.object({
    question: z.string().describe('The quiz question.'),
    options: z.array(z.string()).length(4).describe('An array of 4 possible answers for the question.'),
    correct_answer: z.string().describe('The correct answer to the question.'),
    explanation: z.string().describe('A detailed explanation of why the answer is correct, quoting or referencing the lesson content.'),
});

const GenerateQuizForLessonOutputSchema = z.object({
  lesson_id: z.string().describe('The ID of the lesson this quiz belongs to.'),
  questions: z.array(QuestionSchema).length(10).describe('A list of 10 quiz questions.'),
  pass_score: z.number().default(70).describe('The passing score percentage for the quiz.'),
});
export type GenerateQuizForLessonOutput = z.infer<typeof GenerateQuizForLessonOutputSchema>;

export async function generateQuizForLesson(input: GenerateQuizForLessonInput): Promise<GenerateQuizForLessonOutput> {
  const prompt = `You are an expert quiz creator for educational material. Your task is to generate a 10-question multiple-choice quiz based *only* on the provided lesson content.

**Instructions:**
1.  Read the entire 'lesson_content' provided below.
2.  Create exactly 10 questions that directly test the knowledge within the lesson.
3.  The questions must be distributed as follows:
    - 5 questions to test understanding of core concepts and definitions.
    - 3 questions to test the application of knowledge (e.g., using concepts in a hypothetical scenario based on the lesson's examples).
    - 2 questions to test common mistakes or misconceptions related to the content.
4.  For each question, provide:
    - A clear and unambiguous 'question'.
    - An array of 4 'options'.
    - The 'correct_answer' which must be one of the provided options.
    - A detailed 'explanation' that clarifies why the answer is correct and why the others are not, referencing concepts from the lesson content.
5.  All terminology, definitions, and examples used in the questions and explanations must align with the provided 'lesson_content'. Do not introduce external information.
6.  The final output must be a single, valid JSON object conforming to the specified schema, including the 'lesson_id' from the input and a default 'pass_score' of 70.

**Lesson Content:**
'''
${input.lesson_content}
'''
`;

  const aiText = await generateWithGemini(prompt, false); // Don't cache quizzes
  const result = parseGeminiJson<GenerateQuizForLessonOutput>(aiText);
  
  // Ensure the lesson_id is correctly passed through and pass_score is set
  const finalOutput = {
      ...result,
      lesson_id: input.lesson_id,
      pass_score: 70,
  };

  return GenerateQuizForLessonOutputSchema.parse(finalOutput);
}
