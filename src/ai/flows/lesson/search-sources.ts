
'use server';
/**
 * @fileOverview This file defines the Genkit flow for searching for reputable learning sources.
 *
 * The flow takes a topic and a learning phase as input and returns a list of 10-15 relevant web sources.
 *
 * @exports searchSources - The main function to find learning sources for a given topic and phase.
 */

import { ai } from '../../../../genkit.config';
import {z} from 'zod';

const SearchSourcesInputSchema = z.object({
  topic: z.string().describe('The topic of study (e.g., "React Hooks", "Quantum Physics").'),
  phase: z.string().describe('The learning phase (e.g., "Beginner", "Intermediate", "Advanced").'),
});
type SearchSourcesInput = z.infer<typeof SearchSourcesInputSchema>;

const SourceSchema = z.object({
  title: z.string().describe('The descriptive title of the source.'),
  url: z.string().url().describe('The full URL of the source.'),
  domain: z.string().describe('The domain name of the source (e.g., "react.dev", "youtube.com").'),
  type: z.enum(['article', 'doc', 'video', 'tutorial']).describe('The type of content.'),
  relevance: z.number().min(0.0).max(1.0).describe('A score from 0.0 to 1.0 indicating relevance to the topic and phase.'),
});

const SearchSourcesOutputSchema = z.object({
  sources: z.array(SourceSchema).describe('An array of 10-15 reputable information sources.'),
});
type SearchSourcesOutput = z.infer<typeof SearchSourcesOutputSchema>;


export async function searchSources(input: SearchSourcesInput): Promise<SearchSourcesOutput> {
  return searchSourcesFlow(input);
}

const searchPrompt = ai.definePrompt({
  name: 'searchSourcesPrompt',
  input: {schema: SearchSourcesInputSchema},
  output: {schema: SearchSourcesOutputSchema},
  prompt: `You are an expert at finding high-quality, reputable educational resources on the web.

  Your task is to find 10-15 diverse and reliable sources for the given topic and learning phase.

  Topic: {{{topic}}}
  Learning Phase: {{{phase}}}

  Prioritize the following types of domains:
  - Official documentation sites (e.g., *.dev, *.org)
  - Reputable educational institutions and academies.
  - Well-known technical blogs and publications (e.g., Martin Fowler, Smashing Magazine).
  - Official or highly-respected YouTube channels.

  Avoid the following:
  - Spammy sites or content farms.
  - Low-quality or clearly duplicated content.
  - Forums or Q&A sites unless they are the primary source of information.

  For each source, provide the title, full URL, domain, content type, and a relevance score.
  The output must be a valid JSON object containing a "sources" array. If no high-quality results are found, return an empty array.
  `,
});

const searchSourcesFlow = ai.defineFlow(
  {
    name: 'searchSourcesFlow',
    inputSchema: SearchSourcesInputSchema,
    outputSchema: SearchSourcesOutputSchema,
  },
  async input => {
    const {output} = await searchPrompt(input);
    if (!output) {
        throw new Error("Failed to get a valid response from the AI model.");
    }
    return output;
  }
);
