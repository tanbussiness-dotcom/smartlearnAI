'use server';

/**
 * @fileOverview Generates quizzes for knowledge assessment after each learning step.
 *
 * - generateQuizzesForKnowledgeAssessment - A function that handles the quiz generation process.
 * - GenerateQuizzesForKnowledgeAssessmentInput - The input type for the generateQuizzesForKnowledgeAssessment function.
 * - GenerateQuizzesForKnowledgeAssessmentOutput - The return type for the generateQuizzesForKnowledgeAssessment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuizzesForKnowledgeAssessmentInputSchema = z.object({
  lessonId: z.string().describe('The ID of the lesson to generate a quiz for.'),
  topic: z.string().describe('The topic of the lesson.'),
  stepTitle: z.string().describe('The title of the learning step.'),
  lessonTitle: z.string().describe('The title of the lesson.'),
  lessonDescription: z.string().describe('The description of the lesson.'),
});
export type GenerateQuizzesForKnowledgeAssessmentInput = z.infer<typeof GenerateQuizzesForKnowledgeAssessmentInputSchema>;

const GenerateQuizzesForKnowledgeAssessmentOutputSchema = z.object({
  quiz: z.object({
    questions: z.array(
      z.object({
        question: z.string().describe('The quiz question.'),
        options: z.array(z.string()).describe('The possible answers for the question.'),
        correctAnswer: z.string().describe('The correct answer to the question.'),
      })
    ).describe('A list of quiz questions.'),
  }).describe('The generated quiz.'),
});
export type GenerateQuizzesForKnowledgeAssessmentOutput = z.infer<typeof GenerateQuizzesForKnowledgeAssessmentOutputSchema>;

export async function generateQuizzesForKnowledgeAssessment(input: GenerateQuizzesForKnowledgeAssessmentInput): Promise<GenerateQuizzesForKnowledgeAssessmentOutput> {
  return generateQuizzesForKnowledgeAssessmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizzesForKnowledgeAssessmentPrompt',
  input: {schema: GenerateQuizzesForKnowledgeAssessmentInputSchema},
  output: {schema: GenerateQuizzesForKnowledgeAssessmentOutputSchema},
  prompt: `You are an expert quiz generator for educational content.

You will generate a quiz with 5 questions related to a lesson.
Each question should have 4 options, with one correct answer.

Topic: {{{topic}}}
Step Title: {{{stepTitle}}}
Lesson Title: {{{lessonTitle}}}
Lesson Description: {{{lessonDescription}}}

Output the quiz in the following JSON format:
{
  "quiz": {
    "questions": [
      {
        "question": "Question 1",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Option A"
      },
      {
        "question": "Question 2",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Option B"
      },
      {
        "question": "Question 3",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Option C"
      },
      {
        "question": "Question 4",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Option D"
      },
      {
        "question": "Question 5",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Option A"
      }
    ]
  }
}
`,
});

const generateQuizzesForKnowledgeAssessmentFlow = ai.defineFlow(
  {
    name: 'generateQuizzesForKnowledgeAssessmentFlow',
    inputSchema: GenerateQuizzesForKnowledgeAssessmentInputSchema,
    outputSchema: GenerateQuizzesForKnowledgeAssessmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
