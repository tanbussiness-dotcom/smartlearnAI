
'use server';
/**
 * @fileOverview Defines the Genkit flow for generating content for a specific section of a lesson.
 *
 * This flow is designed to generate a detailed, focused piece of content for a single
 * part of a larger lesson, ensuring clarity and the inclusion of practical examples.
 *
 * @exports generateLessonSection - The main function to generate a lesson section.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';

// Defines the schema for the flow's input.
const GenerateLessonSectionInputSchema = z.object({
  topic: z.string().describe('The overall topic of the lesson (e.g., "Python Data Structures").'),
  section: z
    .string()
    .describe(
      'The specific section title to generate content for (e.g., "Working with Dictionaries").'
    ),
});
type GenerateLessonSectionInput = z.infer<typeof GenerateLessonSectionInputSchema>;

// Defines the schema for the flow's output.
const GenerateLessonSectionOutputSchema = z.object({
  section_title: z
    .string()
    .describe('The title of the generated section, matching the input.'),
  section_content: z
    .string()

    .describe(
      'The detailed content for the section, in Markdown format, between 300 and 400 words.'
    ),
});
type GenerateLessonSectionOutput = z.infer<typeof GenerateLessonSectionOutputSchema>;

export async function generateLessonSection(
  input: GenerateLessonSectionInput
): Promise<GenerateLessonSectionOutput> {
  return generateLessonSectionFlow(input);
}

const generateLessonSectionPrompt = ai.definePrompt({
  name: 'generateLessonSectionPrompt',
  input: { schema: GenerateLessonSectionInputSchema },
  output: { schema: GenerateLessonSectionOutputSchema },
  prompt: `You are an expert instructional writer. Your task is to write a detailed and clear explanation for a specific section of a larger topic.

Topic: {{{topic}}}
Section to write: {{{section}}}

**Instructions:**
1.  Write the content in **Markdown format**.
2.  The content must be between **300 and 400 words**.
3.  Explain the concept clearly and concisely. Avoid jargon where possible, or explain it if necessary.
4.  Include **at least one practical, real-world example** to illustrate the concept. Use code blocks for technical examples if applicable.
5.  Maintain an engaging and encouraging tone.
6.  The final output must be a valid JSON object, with the 'section_title' matching the requested section and the 'section_content' containing your written explanation.

Do not write the entire lesson, only the content for the specified section.
`,
});

const generateLessonSectionFlow = ai.defineFlow(
  {
    name: 'generateLessonSectionFlow',
    inputSchema: GenerateLessonSectionInputSchema,
    outputSchema: GenerateLessonSectionOutputSchema,
  },
  async (input) => {
    const { output } = await generateLessonSectionPrompt(input);
    if (!output) {
      throw new Error('Failed to get a valid response from the AI model.');
    }
    // Ensure the section title in the output matches the input
    output.section_title = input.section;
    return output;
  }
);
