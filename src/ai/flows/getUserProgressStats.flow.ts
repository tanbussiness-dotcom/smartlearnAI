'use server';
/**
 * @fileOverview Defines a server action stub for compiling user progress statistics.
 *
 * This flow is now a stub. The logic should be implemented on the client-side
 * using Firestore queries to avoid server-side Admin SDK usage.
 *
 * @exports getUserProgressStats - The main function to fetch user progress statistics.
 */

import { z } from 'zod';

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

export async function getUserProgressStats(input: GetUserProgressStatsInput): Promise<GetUserProgressStatsOutput> {
    return {
        totalTopics: 0,
        totalLessons: 0,
        completedLessons: 0,
        averageProgress: 0,
        learningStreak: 0,
        lastUpdated: new Date().toISOString(),
    };
}
