
'use server';
/**
 * @fileOverview Defines the Genkit flow for retrieving a complete lesson from Firestore.
 *
 * This flow fetches all data related to a single lesson, including its metadata,
 * the overall outline, and the content of all its individual sections from the
 * /sections subcollection.
 *
 * @exports getLessonFromFirestore - The main function to fetch lesson data.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Input schema for the flow.
const GetLessonFromFirestoreInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  lessonId: z.string().describe('The ID of the lesson document to fetch.'),
});
export type GetLessonFromFirestoreInput = z.infer<
  typeof GetLessonFromFirestoreInputSchema
>;

const QuizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
});

// Output schema for the flow.
const GetLessonFromFirestoreOutputSchema = z.object({
    meta: z.any().describe('The metadata of the lesson.'),
    outline: z.array(z.any()).describe('The outline of the lesson.'),
    sections: z.record(z.string(), z.object({
        title: z.string(),
        content: z.string(),
        quiz: z.array(QuizQuestionSchema)
    })).describe('An object containing all section data, keyed by sectionId.'),
    error: z.string().optional().describe('An error message if the fetch failed.')
});
export type GetLessonFromFirestoreOutput = z.infer<
  typeof GetLessonFromFirestoreOutputSchema
>;

export const getLessonFromFirestore = ai.defineFlow(
  {
    name: 'getLessonFromFirestore',
    inputSchema: GetLessonFromFirestoreInputSchema,
    outputSchema: GetLessonFromFirestoreOutputSchema,
  },
  async (input) => {
    // Initialize Firebase Admin SDK if it hasn't been already.
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } catch (e) {
        console.error('Firebase Admin initialization error:', e);
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

    const { userId, topicId, lessonId } = input;
    const basePath = `users/${userId}/topics/${topicId}/lessons/${lessonId}`;

    console.log(`📖 Fetching lesson from Firestore: ${basePath}`);

    try {
      // 1. Get lesson metadata and outline
      const lessonDoc = await db.doc(basePath).get();
      if (!lessonDoc.exists) {
        throw new Error('Lesson not found in Firestore.');
      }
      const lessonData = lessonDoc.data();

      // 2. Get all documents from the /sections subcollection
      const sectionsSnapshot = await db.collection(`${basePath}/sections`).get();
      const sections: Record<string, any> = {};
      sectionsSnapshot.forEach(doc => {
        sections[doc.id] = doc.data();
      });

      console.log(`✅ Lesson fetched successfully: ${lessonData?.meta?.title}`);

      return {
        meta: lessonData?.meta || {},
        outline: lessonData?.outline || [],
        sections,
      };
    } catch (error: any) {
      console.error('❌ Failed to fetch lesson from Firestore:', error);
      return {
        meta: {},
        outline: [],
        sections: {},
        error: error.message,
      };
    }
  }
);
