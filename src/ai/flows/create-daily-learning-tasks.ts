
'use server';

/**
 * @fileOverview This file defines the server action for creating daily learning tasks based on the lessons.
 *
 * The flow takes a list of lessons and divides them into daily tasks for the user.
 * It exports the `createDailyLearningTasks` function.
 */

import {z} from 'zod';

const CreateDailyLearningTasksInputSchema = z.object({
  lessons: z.array(
    z.object({
      lessonId: z.string().describe('The ID of the lesson.'),
      title: z.string().describe('The title of the lesson.'),
      description: z.string().describe('A brief description of the lesson.'),
    })
  ).describe('A list of lessons to be divided into daily tasks.'),
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the topic.'),
  tasksPerDay: z.number().default(3).describe('The number of tasks to assign per day.'),
});
type CreateDailyLearningTasksInput = z.infer<typeof CreateDailyLearningTasksInputSchema>;

const CreateDailyLearningTasksOutputSchema = z.array(
  z.object({
    userId: z.string().describe('The ID of the user.'),
    topicId: z.string().describe('The ID of the topic.'),
    lessonId: z.string().describe('The ID of the lesson.'),
    date: z.string().describe('The date for the task in ISO format (YYYY-MM-DD).'),
  })
);
type CreateDailyLearningTasksOutput = z.infer<typeof CreateDailyLearningTasksOutputSchema>;

export async function createDailyLearningTasks(input: CreateDailyLearningTasksInput): Promise<CreateDailyLearningTasksOutput> {
    const {lessons, userId, topicId, tasksPerDay} = input;
    const dailyTasks: CreateDailyLearningTasksOutput = [];
    let currentDate = new Date();

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const date = currentDate.toISOString().slice(0, 10);

      dailyTasks.push({
        userId: userId,
        topicId: topicId,
        lessonId: lesson.lessonId,
        date: date,
      });

      if ((i + 1) % tasksPerDay === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return dailyTasks;
}
