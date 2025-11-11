'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, LoaderCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, doc, writeBatch } from 'firebase/firestore';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PopularTopics } from '@/components/popular-topics';
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { generatePersonalizedLearningRoadmap } from '@/ai/flows/generate-personalized-learning-roadmap';
import { useToast } from '@/hooks/use-toast';
import { LessonGeneratingModal } from '@/components/lesson-generating-modal';

export default function SearchPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, currentStepKey: '' });

  const handleGenerateRoadmap = async (currentTopic: string) => {
    if (!currentTopic.trim()) {
      toast({
        variant: 'destructive',
        title: 'Yêu cầu nhập chủ đề',
        description: 'Vui lòng nhập chủ đề để tạo lộ trình.',
      });
      return;
    }
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Lỗi xác thực',
        description: 'Bạn cần đăng nhập để tạo lộ trình.',
      });
      router.push('/login');
      return;
    }

    setLoading(true);
    setModalState({ isOpen: true, currentStepKey: 'start' });

    try {
      // Step 1: Create the parent topic document
      setModalState({ isOpen: true, currentStepKey: 'topic' });
      const topicRef = await addDocumentNonBlocking(
        collection(firestore, 'users', user.uid, 'topics'), {
          title: currentTopic,
          createdBy: user.uid,
          createdAt: new Date().toISOString(),
          progress: 0,
        }
      );
      const topicId = topicRef.id;

      // Step 2: Generate Roadmap from AI
      setModalState({ isOpen: true, currentStepKey: 'roadmap' });
      const roadmapResult = await generatePersonalizedLearningRoadmap({
        topic: currentTopic,
        duration: '1 tháng',
        level: 'người mới bắt đầu',
        goal: 'nắm vững kiến thức nền tảng và có thể áp dụng vào dự án nhỏ',
        targetAudience: 'người tự học'
      });

      if (!roadmapResult || !roadmapResult.roadmap) {
        throw new Error('AI không thể tạo được lộ trình. Vui lòng thử lại.');
      }
      
      // Update topic with generated title
      updateDocumentNonBlocking(topicRef, { title: roadmapResult.title });


      // Step 3: Save the entire roadmap structure to Firestore
      setModalState({ isOpen: true, currentStepKey: 'save' });
      const batch = writeBatch(firestore);

      let totalLessons = 0;
      roadmapResult.roadmap.forEach((phase, phaseIndex) => {
        const roadmapDocRef = doc(collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps'));
        const isFirstPhase = phaseIndex === 0;

        batch.set(roadmapDocRef, {
          stepNumber: phaseIndex + 1,
          stepTitle: phase.title,
          description: phase.goal,
          duration: phase.duration,
          status: isFirstPhase ? 'Learning' : 'Locked',
        });

        phase.lessons.forEach((lesson) => {
          totalLessons++;
          const lessonDocRef = doc(collection(roadmapDocRef, 'lessons'));
          batch.set(lessonDocRef, {
            title: lesson.title,
            description: lesson.description,
            difficulty: lesson.difficulty,
            status: 'To Learn',
            has_quiz: true, // Assume all lessons will have a quiz
            quiz_ready: false, // Quiz is not generated yet
            isAiGenerated: false, // Content is not generated yet
            topic: roadmapResult.title,
            phase: phase.title,
          });
        });
      });
      
      await batch.commit();

      setModalState({ isOpen: true, currentStepKey: 'done' });
      toast({
        title: 'Đã tạo lộ trình thành công!',
        description: `Lộ trình học cho "${roadmapResult.title}" đã sẵn sàng.`,
      });
      
      // Navigate to the new roadmap page
      router.push(`/roadmap/${topicId}`);

    } catch (error: any) {
      console.error('Failed to generate and store roadmap:', error);
      toast({
        variant: 'destructive',
        title: 'Tạo lộ trình thất bại',
        description: error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      });
      setLoading(false);
      setModalState({ isOpen: false, currentStepKey: '' });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenerateRoadmap(topic);
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center w-full h-full p-4"
    >
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline text-center mb-4">
          Bạn muốn học gì hôm nay?
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          AI sẽ tạo ra một lộ trình học được cá nhân hóa dành riêng cho bạn.
        </p>

        <form onSubmit={handleFormSubmit} className="relative mb-12">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="ví dụ: 'Học Python từ đầu' hoặc 'Căn bản về nấu ăn'"
            className="w-full pl-12 h-14 text-lg rounded-full shadow-lg"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          />
          <Button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full h-10 w-24"
            disabled={loading}
          >
            {loading ? <LoaderCircle className="animate-spin" /> : 'Tạo'}
          </Button>
        </form>
        <PopularTopics />
      </div>
    </motion.div>
    <LessonGeneratingModal isOpen={modalState.isOpen} currentStepKey={modalState.currentStepKey} />
    </>
  );
}
