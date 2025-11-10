
'use server';
/**
 * @fileOverview Defines the Genkit flow for updating lesson progress.
 *
 * This flow updates the status of a specific section within a lesson's outline
 * and recalculates the overall completion percentage for the lesson.
 *
 * @exports updateLessonProgress - The main function to update lesson progress.
 */

import { ai } from '@/genkit.config';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    console.error('Firebase Admin initialization error:', e);
    // In a serverless environment, you might not need to pass credentials
    // if the runtime is already authenticated.
    if (!admin.apps.length) {
       try {
        admin.initializeApp();
       } catch (e2) {
         console.error('Fallback Firebase Admin initialization error:', e2);
       }
    }
  }
}
const db = admin.firestore();

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

export const updateLessonProgress = ai.defineFlow(
  {
    name: 'updateLessonProgress',
    inputSchema: UpdateLessonProgressInputSchema,
    outputSchema: UpdateLessonProgressOutputSchema,
  },
  async (input) => {
    const { userId, topicId, lessonId, sectionId, newStatus } = input;
    const lessonRef = db.doc(
      `users/${userId}/topics/${topicId}/lessons/${lessonId}`
    );

    console.log(
      `📘 Updating section ${sectionId} in lesson ${lessonId} to status: ${newStatus}`
    );

    try {
      const lessonDoc = await lessonRef.get();
      if (!lessonDoc.exists) {
        throw new Error('Lesson not found in Firestore');
      }

      const lessonData = lessonDoc.data();
      let outline = lessonData?.outline || [];

      // 1. Update the status of the specific section in the outline array.
      let sectionFound = false;
      const newOutline = outline.map((section: any) => {
        if (section.sectionId === sectionId) {
          sectionFound = true;
          return { ...section, status: newStatus };
        }
        return section;
      });

      if (!sectionFound) {
        throw new Error(`Section with ID ${sectionId} not found in the outline.`);
      }

      // 2. Calculate the new completion percentage.
      const total = newOutline.length;
      const learnedCount = newOutline.filter(
        (s: any) => s.status === 'learned'
      ).length;
      const progressPercent = total > 0 ? Math.round((learnedCount / total) * 100) : 0;

      // 3. Update the document in Firestore.
      await lessonRef.update({
        outline: newOutline,
        'meta.updatedAt': new Date().toISOString(),
        'meta.progressPercent': progressPercent,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Progress updated: ${progressPercent}% completed`);
      return {
        success: true,
        message: `Progress updated for section ${sectionId}`,
        progressPercent,
      };
    } catch (error: any) {
      console.error('❌ Failed to update progress:', error);
      return { success: false, message: error.message, progressPercent: 0 };
    }
  }
);
