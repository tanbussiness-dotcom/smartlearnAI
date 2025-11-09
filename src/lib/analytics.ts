'use client';
import { logEvent, Analytics } from 'firebase/analytics';

export const trackLessonView = (analytics: Analytics, lessonId: string, lessonTitle: string) => {
  if (!analytics) return;
  logEvent(analytics, 'lesson_view', {
    lesson_id: lessonId,
    lesson_title: lessonTitle,
  });
};

export const trackLessonCompletion = (analytics: Analytics, lessonId: string, method: 'manual' | 'quiz') => {
  if (!analytics) return;
  logEvent(analytics, 'lesson_completed', {
    lesson_id: lessonId,
    completion_method: method,
  });
};

export const trackQuizStart = (analytics: Analytics, quizId: string, topicId: string) => {
    if (!analytics) return;
    logEvent(analytics, 'quiz_start', {
        quiz_id: quizId, // lessonId
        topic_id: topicId,
    });
}

export const trackQuizCompletion = (analytics: Analytics, quizId: string, topicId: string, score: number, passed: boolean) => {
  if (!analytics) return;
  logEvent(analytics, 'quiz_completion', {
    quiz_id: quizId,
    topic_id: topicId,
    score: score,
    passed: passed,
  });
};
