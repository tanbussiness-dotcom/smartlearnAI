'use server';
/**
 * @fileOverview This file defines the orchestrator flow for generating a complete lesson.
 *
 * This flow coordinates multiple sub-flows to perform a sequence of tasks:
 * 1. Search for relevant sources based on a topic and phase.
 * 2. Synthesize a structured lesson from the found sources.
 * 3. Validate the synthesized lesson for quality and accuracy.
 * The flow then returns the complete lesson object, ready for client-side processing,
 * such as saving to a database.
 *
 * @exports generateLesson - The main orchestrator function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFirestore, collectionGroup, query, where, limit, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

import {searchSources} from './search-sources';
import {synthesizeLesson} from './synthesize-lesson';
import {validateLesson} from './validate-lesson';

const SearchSourcesInputSchema = z.object({
  topic: z.string().describe('The topic of study (e.g., "React Hooks", "Quantum Physics").'),
  phase: z.string().describe('The learning phase (e.g., "Beginner", "Intermediate", "Advanced").'),
});

const OutputSourceSchema = z.object({
    title: z.string().describe("The title of the source."),
    url: z.string().url().describe("The URL of the source."),
    domain: z.string().describe("The domain of the source."),
    type: z.enum(['article', 'doc', 'tutorial', 'video']).describe("The type of content."),
    short_note: z.string().describe("A brief note on why this source is relevant or useful (1-2 sentences)."),
});

const VideoSchema = z.object({
    title: z.string().describe("The title of the video."),
    url: z.string().url().describe("The original YouTube watch URL (not an embed link)."),
    channel: z.string().describe("The name of the YouTube channel, if available."),
});

const SynthesizeLessonOutputSchema = z.object({
  title: z.string().describe('A clear and concise title for the lesson.'),
  overview: z.string().describe('A short introductory paragraph that summarizes the main content of the lesson.'),
  content: z.string().describe('The full lesson content in Markdown or HTML format, between 800 and 1200 words, with clear sections and practical examples.'),
  sources: z.array(OutputSourceSchema).describe('A curated list of the most reliable sources used for synthesis.'),
  videos: z.array(VideoSchema).describe('A list of relevant videos found in the sources.'),
});

const ValidateLessonOutputSchema = z.object({
  valid: z.boolean().describe('A boolean indicating if the lesson is considered valid and ready for use.'),
  confidence_score: z.number().min(0).max(1).describe('A score from 0.0 to 1.0 representing the confidence in the lesson\'s quality.'),
  issues: z.array(
    z.object({
      type: z.string().describe('The type of issue found (e.g., "Factual Error", "Plagiarism Concern", "Clarity").'),
      detail: z.string().describe('A detailed description of the specific issue.'),
    })
  ).describe('A list of issues found in the lesson draft. Empty if the lesson is valid.'),
});

// Input schema for the orchestrator flow.
const GenerateLessonInputSchema = SearchSourcesInputSchema.extend({
  userId: z.string().describe('The ID of the user requesting the lesson.'),
});

// The final output schema, combining synthesis and validation results.
const GenerateLessonOutputSchema = z.object({
  lesson: SynthesizeLessonOutputSchema,
  validation: ValidateLessonOutputSchema,
  created_by: z.string(),
  created_at: z.string().datetime(),
});

function initializeServerFirebase() {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
}

export async function generateLesson(input: z.infer<typeof GenerateLessonInputSchema>): Promise<z.infer<typeof GenerateLessonOutputSchema>> {
  return generateLessonFlow(input);
}

const generateLessonFlow = ai.defineFlow(
  {
    name: 'generateLessonFlow',
    inputSchema: GenerateLessonInputSchema,
    outputSchema: GenerateLessonOutputSchema,
  },
  async (input) => {
    initializeServerFirebase();
    const { topic, phase, userId } = input;
    
    // Caching logic: Check if a similar lesson already exists and is ready.
    // This uses a collectionGroup query, which requires a Firestore index.
    // The index to create is: collection: 'lessons', fields: 'topic' (asc), 'phase' (asc), 'status' (asc).
    const firestore = getFirestore();
    const lessonsRef = collectionGroup(firestore, 'lessons');
    const cacheQuery = query(
      lessonsRef,
      where('topic', '==', topic),
      where('phase', '==', phase),
      where('status', '==', 'ready'),
      limit(1)
    );

    const cachedSnapshot = await getDocs(cacheQuery);
    if (!cachedSnapshot.empty) {
      console.log(`[generateLesson] Step 0: Found cached lesson for topic "${topic}"`);
      const cachedData = cachedSnapshot.docs[0].data();
      // Reconstruct the output to match the flow's schema, updating user and timestamp
      return {
        lesson: {
            title: cachedData.title,
            overview: cachedData.overview,
            content: cachedData.content,
            sources: cachedData.sources,
            videos: cachedData.videos,
        },
        validation: { // Assume cached lessons are valid
            valid: true,
            confidence_score: 1.0,
            issues: [],
        },
        created_by: userId, // Attribute to the current user
        created_at: new Date().toISOString(), // Set a new creation date
      };
    }


    // Step 1: Search for sources
    console.log(`[generateLesson] Step 1: Searching sources for topic: "${topic}"`);
    const searchResult = await searchSources({ topic, phase });
    if (!searchResult.sources || searchResult.sources.length === 0) {
      console.error('[generateLesson] Step 1 FAILED: No sources found.');
      throw new Error('Could not find any relevant sources for the topic.');
    }
    console.log(`[generateLesson] Step 1 COMPLETED: Found ${searchResult.sources.length} sources.`);

    // Step 2: Synthesize the lesson from the sources
    console.log('[generateLesson] Step 2: Synthesizing lesson...');
    const lessonDraft = await synthesizeLesson({
      topic,
      phase,
      sources: searchResult.sources,
    });
    console.log('[generateLesson] Step 2 COMPLETED: Lesson draft created.');

    // Step 2.5: Basic content validation before calling the validation AI
    console.log('[generateLesson] Step 2.5: Performing basic validation...');
    const wordCount = lessonDraft.content.split(/\s+/).length;
    const hasHeadings = /^(##|###) /m.test(lessonDraft.content);

    if (wordCount < 800 || !hasHeadings) {
        let feedback = `Validation failed: `;
        if (wordCount < 800) feedback += `Content is too short (${wordCount} words). `;
        if (!hasHeadings) feedback += `Content is missing proper section headings (## or ###). `;
        
        console.error(`[generateLesson] Step 2.5 FAILED: ${feedback}`);
        throw new Error(feedback);
    }
    console.log(`[generateLesson] Step 2.5 COMPLETED: Basic checks passed (Words: ${wordCount}, Headings: ${hasHeadings}).`);


    // Step 3: Validate the synthesized lesson using AI
    console.log('[generateLesson] Step 3: Validating lesson with AI...');
    const validationResult = await validateLesson({ lessonDraft });
    console.log(`[generateLesson] Step 3 COMPLETED: Validation result: ${validationResult.valid} (Confidence: ${validationResult.confidence_score})`);

    // The actual saving logic is handled on the client-side after this flow returns.
    // The returned object will be saved to the user's specific lesson document.
    // If it's a new lesson, it effectively populates our cache for future users.
    return {
      lesson: lessonDraft,
      validation: validationResult,
      created_by: userId,
      created_at: new Date().toISOString(),
    };
  }
);
