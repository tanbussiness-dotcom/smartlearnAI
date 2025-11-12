/**
 * @fileOverview This file contains shared Zod schemas and TypeScript types for lesson generation flows.
 */

import { z } from 'zod';

// From search-sources.ts
const SourceSchema = z.object({
  title: z.string().min(1).default('Untitled Source'),
  url: z.string().url().default('https://example.com'),
  domain: z.string().default('unknown.domain'),
  type: z.enum(['article', 'doc', 'video', 'tutorial']).default('article'),
  relevance: z.number().min(0).max(1).optional().default(0.5),
});

export const SearchSourcesOutputSchema = z.object({
  sources: z.array(SourceSchema).default([]),
});

// From synthesize-lesson.ts
export const OutputSourceSchema = z.object({
  title: z.string().min(1).default('Untitled Source'),
  url: z.string().url().default('https://example.com'),
  domain: z.string().default('unknown.domain'),
  type: z.enum(['article', 'doc', 'tutorial', 'video']).default('article'),
  relevance: z.number().optional().default(0.5),
  short_note: z.string().optional().default('No short note available.'),
});

export const SynthesizeLessonOutputSchema = z.object({
  title: z.string().min(1).default('Untitled Lesson'),
  overview: z.string().optional().default('An AI-generated lesson overview.'),
  content: z.string().min(10).default('<p>No content generated.</p>'),
  sources: z.array(OutputSourceSchema).default([]),
  estimated_time_min: z.number().optional().default(5),
});

// From validate-lesson.ts
export const ValidateLessonOutputSchema = z.object({
  valid: z.boolean().default(false),
  confidence_score: z.number().min(0).max(1).default(0.5),
  issues: z.array(
    z.object({
      type: z.string().default('General'),
      detail: z.string().default('No issue details provided.'),
    })
  ).default([]),
});

// From generate-quiz-for-lesson.ts
const QuestionSchema = z.object({
  question: z.string().min(1).default('No question generated.'),
  options: z.array(z.string()).min(1).max(4).default(['A', 'B', 'C', 'D']),
  correct_answer: z.string().optional().default('A'),
  explanation: z.string().optional().default('No explanation provided.'),
});

export const GenerateQuizForLessonOutputSchema = z.object({
  lesson_id: z.string().min(1).default('unknown-lesson'),
  title: z.string().optional(),
  questions: z.array(QuestionSchema).min(0).max(5).default([]),
  pass_score: z.number().min(0).max(100).default(80),
});
