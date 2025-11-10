'use server';
/**
 * @fileOverview Defines the Genkit flow for compiling comprehensive user progress statistics.
 *
 * This flow aggregates data across a user's topics and lessons to calculate key
 * performance indicators such as total topics, completed lessons, average progress,
 * and the current learning streak (consecutive days of learning).
 *
 * @exports getUserProgressStats - The main function to fetch user progress statistics.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Defines the schema for the flow's input.
const GetUserProgressStatsInputSchema = z.object({
  userId: z.string().describe('The ID of the user for whom to fetch stats.'),
});
export type GetUserProgressStatsInput = z.infer<
  typeof GetUserProgressStatsInputSchema
>;

// Defines the schema for the flow's output.
const GetUserProgressStatsOutputSchema = z.object({
  totalTopics: z.number().describe('The total number of topics the user has started.'),
  totalLessons: z.number().describe('The total number of lessons across all topics.'),
  completedLessons: z.number().describe('The number of lessons marked as "Learned".'),
  averageProgress: z.number().describe('The average completion percentage across all lessons.'),
  learningStreak: z.number().describe('The number of consecutive days the user has learned.'),
  lastUpdated: z.string().datetime().describe('The timestamp when the stats were last calculated.'),
});
export type GetUserProgressStatsOutput = z.infer<
  typeof GetUserProgressStatsOutputSchema
>;

/**
 * Calculates the learning streak (number of consecutive days of learning).
 * @param dates - An array of ISO date strings or Date objects.
 * @returns The number of consecutive days in the streak.
 */
function calculateLearningStreak(dates: (string | Date)[]): number {
    if (!dates || dates.length === 0) return 0;

    // Create a Set of unique dates (YYYY-MM-DD) to handle multiple lessons on the same day.
    const uniqueDays = new Set(
        dates.map(d => new Date(d).toISOString().split('T')[0])
    );
    
    if (uniqueDays.size === 0) return 0;

    // Convert Set to an array of timestamps and sort descending.
    const sortedTimestamps = Array.from(uniqueDays)
        .map(day => new Date(day).getTime())
        .sort((a, b) => b - a);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Check if the most recent learning day is today or yesterday.
    const mostRecentDay = sortedTimestamps[0];
    const diffFromToday = (todayTimestamp - mostRecentDay) / (1000 * 60 * 60 * 24);

    if (diffFromToday > 1) {
        return 0; // Streak is broken if the last session was more than one day ago.
    }

    let streak = 1;
    for (let i = 0; i < sortedTimestamps.length - 1; i++) {
        const diffDays = Math.round((sortedTimestamps[i] - sortedTimestamps[i + 1]) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            streak++;
        } else {
            // Break the loop as soon as a gap is found.
            break;
        }
    }
    return streak;
}


export const getUserProgressStats = ai.defineFlow(
  {
    name: 'getUserProgressStats',
    inputSchema: GetUserProgressStatsInputSchema,
    outputSchema: GetUserProgressStatsOutputSchema,
  },
  async (input) => {
    const { userId } = input;
    const topicsPath = `users/${userId}/topics`;

    console.log(`📊 Fetching progress stats for user: ${userId}`);

    try {
      const topicsSnapshot = await db.collection(topicsPath).get();
      let totalTopics = 0;
      let totalLessons = 0;
      let completedLessons = 0;
      let lessonDates: string[] = [];

      for (const topicDoc of topicsSnapshot.docs) {
        totalTopics++;
        const roadmapsSnapshot = await db.collection(`${topicsPath}/${topicDoc.id}/roadmaps`).get();
        for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonsSnapshot = await db.collection(roadmapDoc.ref.path + '/lessons').get();
            lessonsSnapshot.forEach(lessonDoc => {
                totalLessons++;
                const data = lessonDoc.data();
                if (data.status === 'Learned') {
                    completedLessons++;
                }
                // Use lastUpdated or a similar field that marks activity.
                if (data.updatedAt) {
                    lessonDates.push(data.updatedAt);
                } else if (data.createdAt) {
                    lessonDates.push(data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt);
                }
            });
        }
      }

      // Calculate average progress based on completion.
      const averageProgress =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      // Calculate learning streak.
      const learningStreak = calculateLearningStreak(lessonDates);

      console.log('✅ User progress calculated successfully');
      return {
        totalTopics,
        totalLessons,
        completedLessons,
        averageProgress,
        learningStreak,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('❌ Failed to calculate user progress:', error);
      // Return a default error state.
      return {
        totalTopics: 0,
        totalLessons: 0,
        completedLessons: 0,
        averageProgress: 0,
        learningStreak: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
);
