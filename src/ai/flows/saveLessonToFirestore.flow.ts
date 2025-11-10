'use server';
/**
 * @fileOverview Defines the Genkit flow for saving lesson data to Firestore.
 *
 * This flow acts as a bridge between the AI generation flows and the database,
 * allowing structured data (outlines, sections) to be saved to the correct
 * Firestore documents using the Firebase Admin SDK for secure server-side operations.
 *
 * @exports saveLessonToFirestore - The main function to save lesson data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Input schema for the flow.
const SaveLessonToFirestoreInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  lessonId: z.string().describe('The ID of the lesson document to save to.'),
  type: z
    .enum(['outline', 'section'])
    .describe("The type of data being saved ('outline' or 'section')."),
  data: z.any().describe('The data payload to save.'),
});
export type SaveLessonToFirestoreInput = z.infer<
  typeof SaveLessonToFirestoreInputSchema
>;

// Output schema for the flow.
const SaveLessonToFirestoreOutputSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful.'),
  message: z.string().describe('A message detailing the result.'),
  path: z.string().describe('The Firestore path that was written to.'),
});
export type SaveLessonToFirestoreOutput = z.infer<
  typeof SaveLessonToFirestoreOutputSchema
>;

export const saveLessonToFirestore = ai.defineFlow(
  {
    name: 'saveLessonToFirestore',
    inputSchema: SaveLessonToFirestoreInputSchema,
    outputSchema: SaveLessonToFirestoreOutputSchema,
  },
  async (input) => {
    const { userId, topicId, lessonId, type, data } = input;
    const basePath = `users/${userId}/topics/${topicId}/lessons/${lessonId}`;
    const lessonRef = db.doc(basePath);

    console.log(`🗂 Saving ${type} for lesson ${lessonId}...`);

    try {
      if (type === 'outline') {
        // Here, `data` is expected to be the output of `vertexDynamicOutline`
        await lessonRef.set(
          {
            meta: {
              title: data.title,
              overview: data.overview,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            outline: data.outline, // This is the array of section objects
          },
          { merge: true }
        );

        console.log('✅ Outline saved successfully!');
        return { success: true, message: 'Outline saved.', path: basePath };
      } else if (type === 'section') {
        // Here, `data` is expected to be the output of `vertexDynamicSectionGenerator`
        const sectionPath = `${basePath}/sections/${data.sectionId}`;
        await db.doc(sectionPath).set(
          {
            title: data.title,
            content: data.content,
            quiz: data.quiz || [],
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // To update a specific item in an array, we need to read the doc,
        // update the array in memory, and write it back.
        const lessonDoc = await lessonRef.get();
        const lessonData = lessonDoc.data();
        if (lessonData && Array.isArray(lessonData.outline)) {
            const newOutline = lessonData.outline.map((section: any) => {
                if (section.sectionId === data.sectionId) {
                    return { ...section, status: "completed" };
                }
                return section;
            });
            await lessonRef.update({ outline: newOutline });
        }
        

        console.log(`✅ Section ${data.sectionId} saved successfully!`);
        return {
          success: true,
          message: 'Section saved.',
          path: sectionPath,
        };
      }

      throw new Error('Invalid "type" provided. Must be "outline" or "section".');
    } catch (error: any) {
      console.error('❌ Failed to save lesson to Firestore:', error);
      return { success: false, message: error.message, path: basePath };
    }
  }
);
