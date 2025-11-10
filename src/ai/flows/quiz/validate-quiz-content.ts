
'use server';
/**
 * @fileOverview Defines the Genkit flow for validating the relevance of quiz questions against lesson content.
 *
 * This flow takes the lesson content and a set of quiz questions as input, then uses an AI model
 * to assess whether the questions can be answered solely based on the provided content.
 * It returns a validation score and identifies any questions that are deemed irrelevant.
 *
 * @exports validateQuizContent - The main function to validate a quiz.
 */

import { ai } from '../../../../genkit.config';
import { z } from 'zod';

// Schema for a single question, consistent with quiz generation flow.
const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correct_answer: z.string(),
  explanation: z.string(),
});

// Input schema for the validation flow.
const ValidateQuizContentInputSchema = z.object({
  lesson_content: z
    .string()
    .describe('The full text content of the lesson.'),
  quiz_questions: z
    .array(QuestionSchema)
    .describe('The array of quiz questions to be validated.'),
});
type ValidateQuizContentInput = z.infer<
  typeof ValidateQuizContentInputSchema
>;

// Schema for an invalid question, identifying its index and the reason for invalidity.
const InvalidQuestionSchema = z.object({
  index: z
    .number()
    .describe('The 0-based index of the invalid question in the input array.'),
  reason: z
    .string()
    .describe(
      'A detailed explanation of why the question is considered invalid (e.g., "Content not found", "Requires external knowledge").'
    ),
});

// Output schema for the validation flow.
const ValidateQuizContentOutputSchema = z.object({
  relevance_score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'A score from 0.0 to 1.0 indicating the overall relevance of the quiz to the lesson content.'
    ),
  invalid_questions: z
    .array(InvalidQuestionSchema)
    .describe('A list of questions that are not answerable from the content.'),
  valid: z
    .boolean()
    .describe(
      'A boolean indicating if the quiz is valid (true if relevance_score >= 0.8).'
    ),
  review_required: z
    .boolean()
    .describe('A flag indicating if the quiz requires manual review (true if relevance_score < 0.8).')
});
type ValidateQuizContentOutput = z.infer<
  typeof ValidateQuizContentOutputSchema
>;

export async function validateQuizContent(
  input: ValidateQuizContentInput
): Promise<ValidateQuizContentOutput> {
  return validateQuizContentFlow(input);
}

const validationPrompt = ai.definePrompt({
  name: 'validateQuizContentPrompt',
  input: { schema: ValidateQuizContentInputSchema.extend({ quizQuestionsString: z.string() }) },
  output: { schema: ValidateQuizContentOutputSchema },
  prompt: `You are an expert at Quality Assurance for educational content. Your task is to analyze a given lesson and a set of quiz questions to determine if the questions can be answered *solely* based on the provided lesson content.

**Instructions:**
1.  Carefully read the entire \`lesson_content\`.
2.  For each question in the \`quiz_questions\` array, verify if the question, its options, and its correct answer can be directly inferred or derived from the text.
3.  Calculate a \`relevance_score\` from 0.0 (completely irrelevant) to 1.0 (perfectly relevant). The score should decrease for each question that requires external knowledge or covers topics not mentioned in the lesson.
4.  If any questions are invalid, add them to the \`invalid_questions\` array, specifying their original index and a clear \`reason\` for why they are invalid.
5.  Set \`valid\` to \`true\` if the \`relevance_score\` is 0.8 or higher, otherwise set it to \`false\`.
6.  Set \`review_required\` to \`true\` if the \`relevance_score\` is less than 0.8.

**Lesson Content:**
\`\`\`
{{{lesson_content}}}
\`\`\`

**Quiz Questions to Validate:**
\`\`\`json
{{{quizQuestionsString}}}
\`\`\`

Your final output must be a single, valid JSON object conforming to the specified output schema.`,
});

const validateQuizContentFlow = ai.defineFlow(
  {
    name: 'validateQuizContentFlow',
    inputSchema: ValidateQuizContentInputSchema,
    outputSchema: ValidateQuizContentOutputSchema,
  },
  async input => {
    const { output } = await validationPrompt({
        ...input,
        quizQuestionsString: JSON.stringify(input.quiz_questions),
    });
    if (!output) {
      throw new Error('Failed to get a valid validation response from the AI model.');
    }

    // Business logic enforcement
    const isValid = output.relevance_score >= 0.8;
    output.valid = isValid;
    output.review_required = !isValid;

    if (!isValid && output.invalid_questions.length === 0) {
      output.invalid_questions.push({
        index: -1,
        reason: `The relevance score is below 0.8, but the AI did not specify which questions were invalid. Manual review is recommended.`,
      });
    }

    return output;
  }
);
