'use server';
/**
 * @fileOverview This file defines the Genkit flow for generating detailed lessons for each step in a learning roadmap.
 *
 * The flow takes a step description as input and returns a list of lessons with titles, descriptions, instructions, and YouTube links.
 *
 * @example
 * // Example usage:
 * const lessons = await generateLessonsForEachStep({
 *   stepTitle: "Introduction to Python",
 *   stepDescription: "Learn the basics of Python programming."
 * });
 *
 * @exports generateLessonsForEachStep - The main function to generate lessons for a given step.
 * @exports GenerateLessonsForEachStepInput - The input type for the generateLessonsForEachStep function.
 * @exports GenerateLessonsForEachStepOutput - The output type for the generateLessonsForEachStep function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLessonsForEachStepInputSchema = z.object({
  stepTitle: z.string().describe('The title of the learning step.'),
  stepDescription: z.string().describe('The description of the learning step.'),
});
export type GenerateLessonsForEachStepInput = z.infer<typeof GenerateLessonsForEachStepInputSchema>;

const LessonSchema = z.object({
  title: z.string().describe('The title of the lesson.'),
  description: z.string().describe('A short description of the lesson.'),
  instructions: z.string().describe('Detailed instructions for the lesson.'),
  youtubeLink: z.string().url().describe('A link to a relevant YouTube video.'),
});

const GenerateLessonsForEachStepOutputSchema = z.array(LessonSchema).describe('An array of lessons for the given step.');
export type GenerateLessonsForEachStepOutput = z.infer<typeof GenerateLessonsForEachStepOutputSchema>;

export async function generateLessonsForEachStep(input: GenerateLessonsForEachStepInput): Promise<GenerateLessonsForEachStepOutput> {
  return generateLessonsForEachStepFlow(input);
}

const lessonsPrompt = ai.definePrompt({
  name: 'lessonsPrompt',
  input: {schema: GenerateLessonsForEachStepInputSchema},
  output: {schema: GenerateLessonsForEachStepOutputSchema},
  prompt: `You are an AI assistant designed to generate lessons for a given learning step.

  Given the title and description of a learning step, generate a list of lessons that cover the material in a comprehensive and easy-to-understand manner.

  Each lesson should include:
  - A clear and concise title.
  - A short description explaining the lesson's purpose.
  - Detailed instructions on how to complete the lesson.
  - A link to a relevant YouTube video that provides additional guidance or examples.

  Consider the following step title and description:
  Step Title: {{{stepTitle}}}
  Step Description: {{{stepDescription}}}

  Generate a list of lessons that would be helpful for someone trying to learn this step.
  The output should be a valid JSON array of lesson objects.
  `,  
});

const generateLessonsForEachStepFlow = ai.defineFlow(
  {
    name: 'generateLessonsForEachStepFlow',
    inputSchema: GenerateLessonsForEachStepInputSchema,
    outputSchema: GenerateLessonsForEachStepOutputSchema,
  },
  async input => {
    const {output} = await lessonsPrompt(input);
    return output!;
  }
);
