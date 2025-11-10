'use server';
/**
 * @fileOverview Defines the Genkit flow for synchronizing an AI-generated roadmap to Firestore.
 *
 * This flow takes a user ID, topic ID, and the complete roadmap data from the generation
 * flow and saves it into the Firestore database according to the defined structure.
 * It creates a document for each phase (step) and sub-documents for each lesson.
 *
 * @exports syncRoadmapToFirestore - The main function to save the roadmap.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Define the structure for a lesson within a phase.
const LessonSchema = z.object({
  lessonId: z.string(),
  title: z.string(),
  description: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
});

// Define the structure for a single phase (step) of the roadmap.
const RoadmapPhaseSchema = z.object({
  phaseId: z.string(),
  title: z.string(),
  goal: z.string(),
  duration: z.string(),
  lessons: z.array(LessonSchema),
});

// Input schema for the flow.
const SyncRoadmapToFirestoreInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  roadmapData: z.object({
    title: z.string(),
    overview: z.string(),
    totalDuration: zstring(),
    roadmap: z.array(RoadmapPhaseSchema),
  }),
});
export type SyncRoadmapToFirestoreInput = z.infer<
  typeof SyncRoadmapToFirestoreInputSchema
>;

// Output schema for the flow.
const SyncRoadmapToFirestoreOutputSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful.'),
  message: z.string().describe('A message detailing the result.'),
  roadmapsCreated: z.number().describe('The number of roadmap steps (phases) created.'),
  lessonsCreated: z.number().describe('The total number of lessons created across all phases.'),
});
export type SyncRoadmapToFirestoreOutput = z.infer<
  typeof SyncRoadmapToFirestoreOutputSchema
>;

export const syncRoadmapToFirestore = ai.defineFlow(
  {
    name: 'syncRoadmapToFirestore',
    inputSchema: SyncRoadmapToFirestoreInputSchema,
    outputSchema: SyncRoadmapToFirestoreOutputSchema,
  },
  async (input) => {
    const { userId, topicId, roadmapData } = input;
    const roadmapsPath = `users/${userId}/topics/${topicId}/roadmaps`;
    const roadmapsCol = db.collection(roadmapsPath);

    console.log(`🗺️ Syncing roadmap "${roadmapData.title}" to Firestore...`);

    try {
      const batch = db.batch();
      let totalLessons = 0;
      let stepCounter = 1;

      // Each 'phase' from the AI output becomes a 'roadmap' document in Firestore.
      for (const phase of roadmapData.roadmap) {
        const roadmapDocRef = roadmapsCol.doc(); // Let Firestore generate the ID.

        // Set the main data for the roadmap step (phase).
        batch.set(roadmapDocRef, {
          stepNumber: stepCounter,
          stepTitle: phase.title,
          description: phase.goal,
          status: stepCounter === 1 ? 'Learning' : 'Locked', // First step is active
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Add each lesson to the 'lessons' subcollection of this roadmap step.
        const lessonsColRef = roadmapDocRef.collection('lessons');
        for (const lesson of phase.lessons) {
          const lessonDocRef = lessonsColRef.doc(lesson.lessonId);
          batch.set(lessonDocRef, {
            title: lesson.title,
            description: lesson.description,
            difficulty: lesson.difficulty,
            status: 'To Learn',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            // Add fields for on-demand generation
            topic: roadmapData.title,
            phase: phase.title,
            content: `Nội dung cho bài học này đang được AI tạo. Vui lòng quay lại sau.`,
            has_quiz: true, // Assume all lessons can have a quiz
            quiz_ready: false,
          });
          totalLessons++;
        }
        stepCounter++;
      }

      await batch.commit();

      console.log(`✅ Roadmap synced: ${roadmapData.roadmap.length} phases, ${totalLessons} lessons`);
      return {
        success: true,
        message: 'Roadmap synced successfully!',
        roadmapsCreated: roadmapData.roadmap.length,
        lessonsCreated: totalLessons,
      };
    } catch (error: any) {
      console.error('❌ Failed to sync roadmap:', error);
      return {
        success: false,
        message: error.message,
        roadmapsCreated: 0,
        lessonsCreated: 0,
      };
    }
  }
);
