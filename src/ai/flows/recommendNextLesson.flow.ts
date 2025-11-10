'use server';
/**
 * @fileOverview Defines the Genkit flow for recommending the next lesson to a user.
 *
 * This flow analyzes a user's learning history and progress to generate personalized
 * recommendations for what they should learn next.
 *
 * @exports recommendNextLesson - The main function to generate lesson recommendations.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Input schema for the flow.
const RecommendNextLessonInputSchema = z.object({
  userId: z.string().describe("The ID of the user for whom to generate recommendations."),
});
export type RecommendNextLessonInput = z.infer<
  typeof RecommendNextLessonInputSchema
>;

// Schema for a single recommendation.
const RecommendationSchema = z.object({
  title: z.string().describe("The title of the recommended lesson."),
  description: z.string().describe("A brief (1-2 sentence) description of the lesson."),
  reason: z.string().describe("The reason why this lesson is a good next step for the user."),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("The difficulty level of the lesson."),
});

// Output schema for the flow.
const RecommendNextLessonOutputSchema = z.object({
  recommendations: z
    .array(RecommendationSchema)
    .describe("An array of lesson recommendations."),
});
export type RecommendNextLessonOutput = z.infer<
  typeof RecommendNextLessonOutputSchema
>;

const recommendationPrompt = ai.definePrompt({
    name: 'recommendNextLessonPrompt',
    input: { schema: z.object({ learningContext: z.string() }) },
    output: { schema: RecommendNextLessonOutputSchema },
    prompt: `
    You are an intelligent AI Tutor. Based on the user's recent learning progress provided below, your task is to recommend the 3 most suitable next lessons.

    User's recent lessons:
    {{learningContext}}

    For each recommendation, provide:
    {
      "title": "Recommended Lesson Title",
      "description": "A short (1-2 sentence) description of the lesson.",
      "reason": "Why this lesson is a suitable next step for the learner.",
      "difficulty": "beginner | intermediate | advanced"
    }

    Return the result as a pure JSON object, with no additional markdown or explanations.
    `,
});


export const recommendNextLesson = ai.defineFlow(
  {
    name: 'recommendNextLesson',
    inputSchema: RecommendNextLessonInputSchema,
    outputSchema: RecommendNextLessonOutputSchema,
  },
  async (input) => {
    const { userId } = input;
    const userTopicsPath = `users/${userId}/topics`;

    console.log(`🧠 Generating next lesson recommendations for user: ${userId}`);

    try {
      const topicsSnapshot = await db.collection(userTopicsPath).get();
      let lessonsSummary: any[] = [];

      for (const topicDoc of topicsSnapshot.docs) {
        const roadmapsSnapshot = await db.collection(`${userTopicsPath}/${topicDoc.id}/roadmaps`).get();
        for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonsSnapshot = await db.collection(roadmapDoc.ref.path + '/lessons').get();
            lessonsSnapshot.forEach(lessonDoc => {
                const lessonData = lessonDoc.data();
                lessonsSummary.push({
                    topic: topicDoc.data().title || topicDoc.id,
                    title: lessonData.title || "Untitled",
                    status: lessonData.status || 'To Learn',
                });
            });
        }
      }

      if (lessonsSummary.length === 0) {
        console.warn("⚠️ No lessons found for this user. Suggesting beginner topics.");
        return {
          recommendations: [
            {
              title: "Introduction to Artificial Intelligence",
              description: "Start with the fundamental concepts of AI and its applications in daily life.",
              reason: "User has no learning data, so starting with the basics is recommended.",
              difficulty: "beginner"
            },
            {
              title: "How Computers Learn from Data",
              description: "Explore the principles of Machine Learning through easy-to-understand examples.",
              reason: "Helps build a foundation before tackling more advanced topics.",
              difficulty: "beginner"
            }
          ]
        };
      }

      const learningContext = lessonsSummary
        .map(l => `• Topic: ${l.topic}, Lesson: ${l.title} (Status: ${l.status})`)
        .join("\n");

      const { output } = await recommendationPrompt({ learningContext });

      if (!output) {
        throw new Error('Failed to get a valid response from the AI model.');
      }

      console.log("✅ Recommendations generated successfully");
      return output;

    } catch (error: any) {
      console.error("❌ Failed to generate recommendations:", error);
      return {
        recommendations: [
          {
            title: "Could Not Generate Suggestions",
            description: "The system is busy, please try again later.",
            reason: error.message,
            difficulty: "beginner"
          }
        ]
      };
    }
  }
);
