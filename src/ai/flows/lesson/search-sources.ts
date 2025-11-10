
'use server';
/**
 * @fileOverview This file defines the function for searching for reputable learning sources using Gemini API.
 *
 * It takes a topic and a learning phase as input and returns a list of 10-15 relevant web sources.
 *
 * @exports searchSources - The main function to find learning sources.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';
import { SearchSourcesOutputSchema } from './types';

const SearchSourcesInputSchema = z.object({
  topic: z.string().describe('The topic of study (e.g., "React Hooks", "Quantum Physics").'),
  phase: z.string().describe('The learning phase (e.g., "Beginner", "Intermediate", "Advanced").'),
});
type SearchSourcesInput = z.infer<typeof SearchSourcesInputSchema>;
type SearchSourcesOutput = z.infer<typeof SearchSourcesOutputSchema>;

export async function searchSources(input: SearchSourcesInput): Promise<SearchSourcesOutput> {
  const prompt = `You are an expert at finding high-quality, reputable educational resources on the web.

  Your task is to find 10-15 diverse and reliable sources for the given topic and learning phase.

  Topic: ${input.topic}
  Learning Phase: ${input.phase}

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
  `;

  const aiText = await generateWithGemini(prompt);
  const result = parseGeminiJson<SearchSourcesOutput>(aiText);
  return SearchSourcesOutputSchema.parse(result);
}
