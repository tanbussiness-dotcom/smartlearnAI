/**
 * @fileOverview This file contains shared Zod schemas and TypeScript types for lesson generation flows.
 */

import { z } from 'zod';

// From search-sources.ts
const SourceSchema = z.object({
  title: z.string().describe('The descriptive title of the source.'),
  url: z.string().url().describe('The full URL of the source.'),
  domain: z.string().describe('The domain name of the source (e.g., "react.dev", "youtube.com").'),
  type: z.enum(['article', 'doc', 'video', 'tutorial']).describe('The type of content.'),
  relevance: z.number().min(0.0).max(1.0).describe('A score from 0.0 to 1.0 indicating relevance to the topic and phase.'),
});

export const SearchSourcesOutputSchema = z.object({
  sources: z.array(SourceSchema).describe('An array of 10-15 reputable information sources.'),
});

// From synthesize-lesson.ts
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

export const SynthesizeLessonOutputSchema = z.object({
  title: z.string().describe('A clear and concise title for the lesson.'),
  overview: z.string().describe('A short introductory paragraph that summarizes the main content of the lesson.'),
  content: z.string().describe('The full lesson content in Markdown or HTML format, between 800 and 1200 words, with clear sections and practical examples.'),
  sources: z.array(OutputSourceSchema).describe('A curated list of the most reliable sources used for synthesis.'),
  videos: z.array(VideoSchema).describe('A list of relevant videos found in the sources.'),
  estimated_time_min: z.number().describe('Estimated time in minutes to complete the lesson.'),
});

// From validate-lesson.ts
export const ValidateLessonOutputSchema = z.object({
  valid: z.boolean().describe('A boolean indicating if the lesson is considered valid and ready for use.'),
  confidence_score: z.number().min(0).max(1).describe('A score from 0.0 to 1.0 representing the confidence in the lesson\'s quality.'),
  issues: z.array(
    z.object({
      type: z.string().describe('The type of issue found (e.g., "Factual Error", "Plagiarism Concern", "Clarity").'),
      detail: z.string().describe('A detailed description of the specific issue.'),
    })
  ).describe('A list of issues found in the lesson draft. Empty if the lesson is valid.'),
});

// From generate-quiz-for-lesson.ts
const QuestionSchema = z.object({
    question: z.string().describe('The quiz question.'),
    options: z.array(z.string()).length(4).describe('An array of 4 possible answers for the question.'),
    correct_answer: z.string().describe('The correct answer to the question.'),
    explanation: z.string().describe('A detailed explanation of why the answer is correct, quoting or referencing the lesson content.'),
});

export const GenerateQuizForLessonOutputSchema = z.object({
  lesson_id: z.string().describe('The ID of the lesson this quiz belongs to.'),
  questions: z.array(QuestionSchema).length(5).describe('A list of 5 quiz questions.'),
  pass_score: z.number().default(80).describe('The passing score percentage for the quiz.'),
});
