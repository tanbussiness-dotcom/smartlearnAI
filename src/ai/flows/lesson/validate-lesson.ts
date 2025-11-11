
'use server';
/**
 * @fileOverview This file defines the function for validating a synthesized lesson using Gemini API.
 *
 * @exports validateLesson - The main function to validate a lesson draft.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';
import { SynthesizeLessonOutputSchema, ValidateLessonOutputSchema } from './types';


const ValidateLessonInputSchema = z.object({
  lessonDraft: SynthesizeLessonOutputSchema.describe('The lesson object to be validated.'),
});
type ValidateLessonInput = z.infer<typeof ValidateLessonInputSchema>;
type ValidateLessonOutput = z.infer<typeof ValidateLessonOutputSchema>;

export async function validateLesson(input: ValidateLessonInput): Promise<ValidateLessonOutput> {
  const lessonContentForValidation = {
    title: input.lessonDraft.title,
    overview: input.lessonDraft.overview,
    content: input.lessonDraft.content,
  };
  const lessonDraftString = JSON.stringify(lessonContentForValidation, null, 2);
  
  const prompt = `
You are a QA validator for AI lessons.
Return ONLY JSON, strictly matching this schema:
{
  "valid": boolean,
  "confidence_score": number,
  "issues": [{ "type": string, "detail": string }]
}
Review this lesson content:

${lessonDraftString}

Rules:
- No markdown, no explanation, no prefix.
- If invalid JSON, output will be rejected.
`;

  const aiText = await generateWithGemini(prompt);
  console.log('[validateLesson] Raw output:', aiText.slice(0, 400));

  let output;
    try {
        output = parseGeminiJson<ValidateLessonOutput>(aiText);
    } catch (e: any) {
        console.error('[validateLesson] JSON parse error', e);
        return {
            valid: false,
            confidence_score: 0,
            issues: [{ type: 'ParseError', detail: e.message }],
        };
    }

  // Enforce the business rule: if score < 0.7, valid must be false.
  if (output.confidence_score < 0.7 && output.valid) {
    output.valid = false;
    if (output.issues.length === 0) {
      output.issues.push({
        type: 'Low Confidence',
        detail: `The overall confidence score of ${output.confidence_score} is below the required threshold of 0.7, but no specific issues were itemized. Manual review is required.`,
      });
    }
  }
  
  return ValidateLessonOutputSchema.parse(output);
}
