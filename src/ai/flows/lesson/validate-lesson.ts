'use server';
import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';
import { ValidateLessonOutputSchema } from './types';

export async function validateLesson(input: { lessonDraft: any }) {
  const lesson = input.lessonDraft || {};
  const lessonText = JSON.stringify(
    {
      title: lesson.title || '',
      overview: lesson.overview || '',
      content: lesson.content || '',
    },
    null,
    2
  );

  const prompt = `
You are a QA validator for AI-generated lessons.
Return ONLY JSON strictly matching this schema:
{
  "valid": boolean,
  "confidence_score": number,
  "issues": [{ "type": string, "detail": string }]
}
Evaluate this lesson content:
${lessonText}
Rules:
- Return only JSON. No extra text, markdown, or commentary.
`;

  let aiText = '';
  try {
    aiText = await generateWithGemini(prompt);
  } catch (e: any) {
    console.error('[validateLesson] Gemini call failed:', e);
    return {
      valid: false,
      confidence_score: 0,
      issues: [{ type: 'GeminiError', detail: e?.message || 'Gemini API failed' }],
    };
  }

  console.log('[validateLesson] Raw output preview:', (aiText || '').slice(0, 800));

  let parsed: any;
  try {
    parsed = parseGeminiJson(aiText);
  } catch (e: any) {
    console.error('[validateLesson] parseGeminiJson failed:', e?.message);
    return {
      valid: false,
      confidence_score: 0,
      issues: [{ type: 'ParseError', detail: e?.message || 'Invalid JSON output from AI' }],
    };
  }

  try {
    const safe = {
      valid: Boolean(parsed.valid),
      confidence_score:
        typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };

    try {
      return ValidateLessonOutputSchema.parse(safe);
    } catch (zerr: any) {
      console.warn('[validateLesson] Zod parse warning:', zerr?.message || zerr);
      return {
        valid: false,
        confidence_score: safe.confidence_score,
        issues:
          safe.issues.length > 0
            ? safe.issues
            : [{ type: 'SchemaMismatch', detail: 'Output did not match schema' }],
      };
    }
  } catch (err: any) {
    console.error('[validateLesson] unexpected error:', err);
    return {
      valid: false,
      confidence_score: 0,
      issues: [{ type: 'Unexpected', detail: err?.message || 'Unexpected error' }],
    };
  }
}
