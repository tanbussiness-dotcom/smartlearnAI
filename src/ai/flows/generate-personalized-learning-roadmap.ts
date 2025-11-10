'use server';

/**
 * @fileOverview Generates a personalized learning roadmap for a given topic.
 *
 * - generatePersonalizedLearningRoadmap - A function that generates a learning roadmap.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePersonalizedLearningRoadmapInputSchema = z.object({
  topic: z
    .string()
    .describe('The topic for which to generate a learning roadmap.'),
});
export type GeneratePersonalizedLearningRoadmapInput = z.infer<
  typeof GeneratePersonalizedLearningRoadmapInputSchema
>;

const LearningStepSchema = z.object({
  stepNumber: z.number().describe('The step number in the roadmap.'),
  stepTitle: z.string().describe('The title of the learning step.'),
  description: z.string().describe('A detailed description of the step.'),
  skills: z.array(z.string()).describe('The skills acquired in this step.'),
});

const GeneratePersonalizedLearningRoadmapOutputSchema = z.object({
  roadmap: z.array(LearningStepSchema).describe('The generated learning roadmap.'),
});
export type GeneratePersonalizedLearningRoadmapOutput = z.infer<
  typeof GeneratePersonalizedLearningRoadmapOutputSchema
>;

export async function generatePersonalizedLearningRoadmap(
  input: GeneratePersonalizedLearningRoadmapInput
): Promise<GeneratePersonalizedLearningRoadmapOutput> {
  return generatePersonalizedLearningRoadmapFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePersonalizedLearningRoadmapPrompt',
  input: {schema: GeneratePersonalizedLearningRoadmapInputSchema},
  output: {schema: GeneratePersonalizedLearningRoadmapOutputSchema},
  model: 'gemini-1.5-flash',
  prompt: `You are an expert in curriculum design. Generate a personalized, step-by-step learning roadmap from basic to advanced levels for the topic: {{{topic}}}. The roadmap should clearly outline the skills the user will acquire in each step.

Output the roadmap in JSON format. Each step should include a stepNumber, stepTitle, description, and an array of skills.

Example:
{
  "roadmap": [
    {
      "stepNumber": 1,
      "stepTitle": "Introduction to Python",
      "description": "Learn the basic syntax and data structures of Python.",
      "skills": ["Basic Python syntax", "Data structures", "Variables", "Operators"]
    },
    {
      "stepNumber": 2,
      "stepTitle": "Control Flow and Functions",
      "description": "Understand control flow statements and define functions in Python.",
      "skills": ["Conditional statements", "Loops", "Function definitions", "Error handling"]
    }
  ]
}`,
});

const generatePersonalizedLearningRoadmapFlow = ai.defineFlow(
  {
    name: 'generatePersonalizedLearningRoadmapFlow',
    inputSchema: GeneratePersonalizedLearningRoadmapInputSchema,
    outputSchema: GeneratePersonalizedLearningRoadmapOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
