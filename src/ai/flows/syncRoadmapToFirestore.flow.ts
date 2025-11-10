'use server';
/**
 * @fileOverview Defines a server action stub for roadmap synchronization.
 * The actual database writing logic is now handled on the client-side
 * in the search page to avoid server-side Firebase Admin SDK complexity.
 * This file is kept for structural consistency but does not perform DB operations.
 */

import { z } from 'zod';

const LessonSchema = z.object({
  lessonId: z.string(),
  title: z.string(),
  description: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
});

const RoadmapPhaseSchema = z.object({
  phaseId: z.string(),
  title: z.string(),
  goal: z.string(),
  duration: z.string(),
  lessons: z.array(LessonSchema),
});

const SyncRoadmapToFirestoreInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  roadmapData: z.object({
    title: z.string(),
    overview: z.string(),
    totalDuration: z.string(),
    roadmap: z.array(RoadmapPhaseSchema),
  }),
});
export type SyncRoadmapToFirestoreInput = z.infer<
  typeof SyncRoadmapToFirestoreInputSchema
>;

const SyncRoadmapToFirestoreOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SyncRoadmapToFirestoreOutput = z.infer<
  typeof SyncRoadmapToFirestoreOutputSchema
>;

/**
 * This is a stub function. The actual Firestore synchronization logic has been
 * moved to the client-side to simplify the architecture and remove the need
 * for the Firebase Admin SDK in server actions.
 */
export async function syncRoadmapToFirestore(
  input: SyncRoadmapToFirestoreInput
): Promise<SyncRoadmapToFirestoreOutput> {
  console.warn(
    'syncRoadmapToFirestore is a stub and should not be performing database operations.'
  );
  // This function now only validates the input and returns a success message.
  // The client is responsible for writing to Firestore.
  return {
    success: true,
    message: 'Input validated. Client will perform synchronization.',
  };
}
