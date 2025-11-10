
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

**Instructions:**
1.  **Prioritize diverse domains:**
    - Official documentation sites (e.g., *.dev, *.org)
    - Reputable educational institutions and academies.
    - Well-known technical blogs and publications (e.g., Martin Fowler, Smashing Magazine).
    - Official or highly-respected YouTube channels.
2.  **Avoid:**
    - Spammy sites or content farms.
    - Low-quality or clearly duplicated content.
    - Forums or Q&A sites unless they are the primary source of information.
3.  **Output Format:**
    - The output must be a single, valid JSON object containing only a "sources" array.
    - Each object in the "sources" array must have the following keys: "title", "url", "domain", "type", and "relevance".
    - The "type" field MUST be one of the following exact string values: "article", "doc", "video", or "tutorial".
    - If no high-quality results are found, return an empty array.

**Example of a valid JSON object:**
\`\`\`json
{
  "sources": [
    {
      "title": "React Official Documentation - Hooks",
      "url": "https://react.dev/reference/react",
      "domain": "react.dev",
      "type": "doc",
      "relevance": 0.95
    },
    {
      "title": "A Complete Guide to useEffect",
      "url": "https://overreacted.io/a-complete-guide-to-useeffect/",
      "domain": "overreacted.io",
      "type": "article",
      "relevance": 0.9
    }
  ]
}
\`\`\`
`;

  const aiText = await generateWithGemini(prompt);
  const result = parseGeminiJson<SearchSourcesOutput>(aiText);
  return SearchSourcesOutputSchema.parse(result);
}
