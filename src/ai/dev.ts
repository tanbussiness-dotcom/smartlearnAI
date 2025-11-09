import { config } from 'dotenv';
config();

import '@/ai/flows/generate-personalized-learning-roadmap.ts';
import '@/ai/flows/create-daily-learning-tasks.ts';
import '@/ai/flows/generate-quizzes-for-knowledge-assessment.ts';
import '@/ai/flows/lesson/search-sources.ts';
import '@/ai/flows/lesson/synthesize-lesson.ts';
import '@/ai/flows/lesson/validate-lesson.ts';
import '@/ai/flows/lesson/generate-lesson.ts';
import '@/ai/flows/quiz/validate-quiz-content.ts';
