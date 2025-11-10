'use server';
/**
 * @fileOverview Defines a server action stub for updating lesson progress.
 *
 * This flow is now a stub. The logic should be implemented on the client-side
 * using Firestore SDK to avoid server-side Admin SDK usage.
 *
 * @exports updateLessonProgress - The main function to update lesson progress.
 */

import { z } from 'zod';

// Defines the schema for the flow's input.
const UpdateLessonProgressInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  lessonId: z.string().describe('The ID of the lesson to update.'),
  sectionId: z.string().describe('The ID of the section to update the status for.'),
  newStatus: z
    .enum(['to_learn', 'learning', 'learned'])
    .describe('The new status for the section.'),
});
export type UpdateLessonProgressInput = z.infer<
  typeof UpdateLessonProgressInputSchema
>;

// Defines the schema for the flow's output.
const UpdateLessonProgressOutputSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful.'),
  message: z.string().describe('A message detailing the result.'),
  progressPercent: z
    .number()
    .describe('The newly calculated progress percentage.'),
});
export type UpdateLessonProgressOutput = z.infer<
  typeof UpdateLessonProgressOutputSchema
>;

export async function updateLessonProgress(input: UpdateLessonProgressInput): Promise<UpdateLessonProgressOutput> {
  console.warn("`updateLessonProgress` is a stub. This logic should be handled client-side.");
  return {
    success: false,
    message: 'Progress update is not implemented on the server. This should be a client-side action.',
    progressPercent: 0,
  };
}
