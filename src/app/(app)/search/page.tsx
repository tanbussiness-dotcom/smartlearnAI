'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, LoaderCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, writeBatch } from 'firebase/firestore';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PopularTopics } from '@/components/popular-topics';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { generatePersonalizedLearningRoadmap } from '@/ai/flows/generate-personalized-learning-roadmap';
import { useToast } from '@/hooks/use-toast';
import { LessonGeneratingModal } from '@/components/lesson-generating-modal';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  useEffect(() => {
    const topicFromUrl = searchParams.get('topic');
    if (topicFromUrl && !loading) {
      setTopic(topicFromUrl);
      handleGenerateRoadmap(topicFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, firestore]);

  const handleGenerateRoadmap = async (currentTopic: string) => {
    if (!currentTopic.trim()) {
      toast({
        variant: 'destructive',
        title: 'Topic is required',
        description: 'Please enter a topic to generate a roadmap.',
      });
      return;
    }
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to create a roadmap.',
      });
      router.push('/login');
      return;
    }

    setLoading(true);
    let topicId: string | undefined = undefined;

    try {
      // Step 1: Generate Roadmap structure from AI
      setLoadingStep('sources'); // Corresponds to "Finding resources"
      const roadmapResult = await generatePersonalizedLearningRoadmap({ topic: currentTopic });

      // Step 2: Create Topic document in Firestore
      setLoadingStep('synthesize'); // Corresponds to "Synthesizing content"
      const topicsCollection = collection(firestore, 'users', user.uid, 'topics');
      const topicRef = await addDocumentNonBlocking(topicsCollection, {
        title: currentTopic,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

      if (!topicRef) {
        throw new Error("Failed to create topic reference in Firestore.");
      }
      topicId = topicRef.id;
      
      // Step 3: Write the entire roadmap to Firestore using a batch write
      setLoadingStep('save');
      const batch = writeBatch(firestore);
      const roadmapsPath = `users/${user.uid}/topics/${topicId}/roadmaps`;
      let stepCounter = 1;

      for (const phase of roadmapResult.roadmap) {
        const roadmapDocRef = collection(firestore, roadmapsPath).doc();
        batch.set(roadmapDocRef, {
            stepNumber: stepCounter,
            stepTitle: phase.title,
            description: phase.goal,
            status: stepCounter === 1 ? 'Learning' : 'Locked',
            createdAt: new Date().toISOString(),
        });

        const lessonsColRef = collection(roadmapDocRef, 'lessons');
        for (const lesson of phase.lessons) {
            const lessonDocRef = lessonsColRef.doc(lesson.lessonId);
            batch.set(lessonDocRef, {
                title: lesson.title,
                description: lesson.description,
                difficulty: lesson.difficulty,
                status: 'To Learn',
                createdAt: new Date().toISOString(),
                topic: roadmapResult.title,
                phase: phase.title,
                content: `Nội dung cho bài học này đang được AI tạo. Vui lòng quay lại sau.`,
                has_quiz: true, 
                quiz_ready: false,
            });
        }
        stepCounter++;
      }
      await batch.commit();

      toast({
        title: 'Roadmap Generated!',
        description: `Your roadmap for "${currentTopic}" is ready.`,
      });

      router.push(`/roadmap/${topicId}`);

    } catch (error: any) {
      console.error('Failed to generate and store roadmap:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'There was an error generating your learning roadmap. Please try again.',
      });
    } finally {
        setLoading(false);
        setLoadingStep('');
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenerateRoadmap(topic);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center w-full h-full p-4"
    >
      <LessonGeneratingModal isOpen={loading} currentStepKey={loadingStep} />
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
            {loading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              'Tạo'
            )}
          </Button>
        </form>
        <PopularTopics />
      </div>
    </motion.div>
  );
}
