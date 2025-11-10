'use server';
/**
 * @fileOverview Defines a server action stub for recommending the next lesson.
 *
 * The original logic required the Firebase Admin SDK to fetch user data. This has
 * been removed. The AI prompt generation part is kept, but the data fetching part
 * needs to be handled by the client. The client should fetch the data and pass it
 * to a new, client-callable AI flow.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';

// Input schema now expects the learning context to be provided by the client.
const RecommendNextLessonInputSchema = z.object({
  userId: z.string().describe("The ID of the user."),
  learningContext: z.string().describe("A summary of the user's recent learning progress."),
});
export type RecommendNextLessonInput = z.infer<
  typeof RecommendNextLessonInputSchema
>;

const RecommendationSchema = z.object({
  title: z.string().describe("The title of the recommended lesson."),
  description: z.string().describe("A brief (1-2 sentence) description of the lesson."),
  reason: z.string().describe("The reason why this lesson is a good next step for the user."),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("The difficulty level of the lesson."),
});

const RecommendNextLessonOutputSchema = z.object({
  recommendations: z
    .array(RecommendationSchema)
    .describe("An array of lesson recommendations."),
});
export type RecommendNextLessonOutput = z.infer<
  typeof RecommendNextLessonOutputSchema
>;

export async function recommendNextLesson(input: RecommendNextLessonInput): Promise<RecommendNextLessonOutput> {
  console.log(`🧠 Generating next lesson recommendations for user: ${input.userId}`);

  try {
    if (!input.learningContext) {
        console.warn("⚠️ No learning context provided. Suggesting beginner topics.");
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
      
    const prompt = `
    You are an intelligent AI Tutor. Based on the user's recent learning progress provided below, your task is to recommend the 3 most suitable next lessons.

    User's recent lessons:
    ${input.learningContext}

    For each recommendation, provide:
    {
      "title": "Recommended Lesson Title",
      "description": "A short (1-2 sentence) description of the lesson.",
      "reason": "Why this lesson is a suitable next step for the learner.",
      "difficulty": "beginner | intermediate | advanced"
    }

    Return the result as a pure JSON object, with no additional markdown or explanations.
    `;

    const aiText = await generateWithGemini(prompt);
    const output = parseGeminiJson<RecommendNextLessonOutput>(aiText);

    console.log("✅ Recommendations generated successfully");
    return RecommendNextLessonOutputSchema.parse(output);

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
