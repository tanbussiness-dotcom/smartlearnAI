
'use server';

/**
 * @fileOverview Generates a personalized learning roadmap for a given topic using the Gemini API.
 */

import { z } from 'zod';
import { generateWithGemini } from '@/lib/gemini';
import { parseGeminiJson } from '@/lib/utils';

const GeneratePersonalizedLearningRoadmapInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a learning roadmap.'),
  duration: z.string().default('6 tháng').describe('The total duration of the course.'),
  level: z.string().default('beginner').describe('The learner\'s level.'),
  goal: z.string().default('nắm vững lĩnh vực').describe('The learning goal.'),
  targetAudience: z.string().default('người mới bắt đầu').describe('The target audience.'),
});
export type GeneratePersonalizedLearningRoadmapInput = z.infer<
  typeof GeneratePersonalizedLearningRoadmapInputSchema
>;

const LessonSchema = z.object({
    lessonId: z.string().describe("A unique ID for the lesson."),
    title: z.string().describe("The title of the lesson."),
    description: z.string().describe("A short description of the lesson."),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("The difficulty of the lesson."),
});

const RoadmapPhaseSchema = z.object({
    phaseId: z.string().describe("A short ID for the phase (e.g., basics, practice)."),
    title: z.string().describe("The title of the phase."),
    goal: z.string().describe("The learning goal for this phase."),
    duration: z.string().describe("The estimated duration for this phase."),
    lessons: z.array(LessonSchema).describe("A list of lessons within this phase."),
});

const GeneratePersonalizedLearningRoadmapOutputSchema = z.object({
  title: z.string().describe("The title of the learning roadmap."),
  overview: z.string().describe("An overview of the roadmap."),
  totalDuration: z.string().describe("The total duration of the roadmap."),
  roadmap: z.array(RoadmapPhaseSchema).describe('The generated learning roadmap.'),
});
export type GeneratePersonalizedLearningRoadmapOutput = z.infer<
  typeof GeneratePersonalizedLearningRoadmapOutputSchema
>;

export async function generatePersonalizedLearningRoadmap(
  input: GeneratePersonalizedLearningRoadmapInput
): Promise<GeneratePersonalizedLearningRoadmapOutput> {
  const prompt = `Bạn là chuyên gia đào tạo và cố vấn học tập AI.
    Hãy thiết kế một lộ trình học tập toàn diện cho lĩnh vực "{{topic}}".
    - Mục tiêu chính: {{goal}}
    - Thời lượng tổng: {{duration}}
    - Cấp độ người học: {{level}}
    - Đối tượng: {{targetAudience}}

    Lộ trình cần chia thành 3–6 giai đoạn (phases), mỗi giai đoạn có:
    - "phaseId": id ngắn gọn (vd: basics, practice, project)
    - "title": tiêu đề giai đoạn
    - "goal": mục tiêu học của giai đoạn
    - "duration": thời lượng dự kiến (vd: 3 tuần)
    - "lessons": danh sách các bài học, mỗi bài có:
        - "lessonId"
        - "title"
        - "description"
        - "difficulty": beginner | intermediate | advanced

    Trả kết quả duy nhất dưới dạng JSON. Không thêm markdown, không giải thích, chỉ JSON thuần.
    `
    .replace('{{topic}}', input.topic)
    .replace('{{goal}}', input.goal)
    .replace('{{duration}}', input.duration)
    .replace('{{level}}', input.level)
    .replace('{{targetAudience}}', input.targetAudience);

  const aiText = await generateWithGemini(prompt);
  const result = parseGeminiJson<GeneratePersonalizedLearningRoadmapOutput>(aiText);
  
  // Validate with Zod before returning
  return GeneratePersonalizedLearningRoadmapOutputSchema.parse(result);
}
