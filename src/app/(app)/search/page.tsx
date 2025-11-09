
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, ArrowRight, LoaderCircle } from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { motion } from 'framer-motion';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useFirestore, addDocumentNonBlocking, FirestorePermissionError, errorEmitter } from '@/firebase';
import { generatePersonalizedLearningRoadmap } from '@/ai/flows/generate-personalized-learning-roadmap';
import { generateLesson } from '@/ai/flows/lesson/generate-lesson';
import { createDailyLearningTasks } from '@/ai/flows/create-daily-learning-tasks';
import { useToast } from '@/hooks/use-toast';
import { LessonGeneratingModal } from '@/components/lesson-generating-modal';


export default function SearchPage() {
  const popularTopics = [
    {
      id: 'python',
      title: 'Python for Beginners',
      description:
        "Start your journey into programming with the world's most popular language.",
      image: PlaceHolderImages.find((img) => img.id === 'topicPython'),
      href: '/roadmap/python-for-beginners',
    },
    {
      id: 'guitar',
      title: 'Learn Acoustic Guitar',
      description:
        "From your first chord to your first song, we'll guide you all the way.",
      image: PlaceHolderImages.find((img) => img.id === 'topicGuitar'),
      href: '/roadmap/learn-acoustic-guitar',
    },
    {
      id: 'marketing',
      title: 'Digital Marketing 101',
      description:
        'Understand the fundamentals of SEO, SEM, and social media marketing.',
      image: PlaceHolderImages.find((img) => img.id === 'topicMarketing'),
      href: '/roadmap/digital-marketing-101',
    },
  ];

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
      // 1. Generate Roadmap
      setLoadingStep('sources');
      const roadmapResult = await generatePersonalizedLearningRoadmap({ topic: currentTopic });

      // 2. Create Topic in Firestore
      setLoadingStep('synthesize');
      const topicsCollection = collection(firestore, 'users', user.uid, 'topics');
      const topicRef = await addDocumentNonBlocking(topicsCollection, {
        title: currentTopic,
        createdBy: user.uid,
      });

      if (!topicRef) {
        throw new Error("Failed to create topic reference.");
      }
      topicId = topicRef.id;
      
      const allLessonsForTopic: { lessonId: string, title: string, description: string }[] = [];
      
      // 3. Generate and store lessons for each roadmap step
      setLoadingStep('validate');
      for (const step of roadmapResult.roadmap) {
        const roadmapStepsCollection = collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps');
        const roadmapStepDoc = await addDocumentNonBlocking(roadmapStepsCollection, {
            ...step,
            status: step.stepNumber === 1 ? 'Learning' : 'Locked',
        });
        
        if (!roadmapStepDoc) {
          toast({ variant: 'destructive', title: `Failed to create roadmap step ${step.stepNumber}`});
          continue;
        }
        const roadmapStepId = roadmapStepDoc.id;

        // Generate a lesson for the step
        const lessonResult = await generateLesson({
          topic: step.stepTitle,
          phase: 'Cơ bản', // Or determine phase based on step
          userId: user.uid,
        });

        if (lessonResult && lessonResult.validation.valid) {
          const lessonsCollection = collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', roadmapStepId, 'lessons');
          const lessonDocRef = await addDocumentNonBlocking(lessonsCollection, {
              ...lessonResult.lesson,
              status: 'To Learn',
              has_quiz: true,
              quiz_ready: false,
              createdAt: lessonResult.created_at,
              userId: user.uid,
          });

          if (lessonDocRef) {
            allLessonsForTopic.push({
                lessonId: lessonDocRef.id,
                title: lessonResult.lesson.title,
                description: lessonResult.lesson.overview
            });
          }
        } else {
          console.warn(`Skipping lesson for step "${step.stepTitle}" due to validation failure.`);
        }
      }
      
      // 4. Create daily tasks from all lessons
      if(allLessonsForTopic.length > 0) {
        setLoadingStep('save');
        const dailyTasksResult = await createDailyLearningTasks({
            lessons: allLessonsForTopic,
            userId: user.uid,
            topicId: topicId,
            tasksPerDay: 1, // Or make this configurable
        });

        const dailyTasksCollection = collection(firestore, 'users', user.uid, 'dailyTasks');
        const batch = writeBatch(firestore);
        const firstTaskData = dailyTasksResult[0];

        for(const task of dailyTasksResult) {
            const taskRef = doc(dailyTasksCollection);
            batch.set(taskRef, { ...task, status: 'To Learn'});
        }
        
        // This is the critical change: ensure batch.commit() is properly handled.
        await batch.commit().catch(serverError => {
            const permissionError = new FirestorePermissionError({
              path: dailyTasksCollection.path,
              operation: 'create',
              requestResourceData: firstTaskData, // Send first task as representative data
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError; // Re-throw to be caught by outer catch block
        });
      }

      toast({
        title: 'Roadmap Generated!',
        description: `Your roadmap for "${currentTopic}" is ready.`,
      });

      router.push(`/roadmap/${topicId}`);

    } catch (error) {
      console.error('Failed to generate and store roadmap:', error);
      // This catch block will now receive permission errors from the batch commit.
      if (!(error instanceof FirestorePermissionError)) {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description:
            'There was an error generating your learning roadmap. Please try again.',
        });
      }
      setLoading(false);
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

        <h2 className="text-2xl font-bold font-headline mb-6">
          Hoặc bắt đầu với một chủ đề phổ biến
        </h2>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
            hidden: {},
          }}
        >
          {popularTopics.map((t) => (
            <motion.div
              key={t.id}
              variants={{
                hidden: { y: 20, opacity: 0 },
                visible: { y: 0, opacity: 1 },
              }}
            >
              <Card className="text-left hover:shadow-xl transition-shadow h-full flex flex-col">
                <CardHeader>
                  {t.image && (
                    <div className="overflow-hidden rounded-lg mb-4">
                      <Image
                        src={t.image.imageUrl}
                        alt={t.title}
                        width={400}
                        height={300}
                        data-ai-hint={t.image.imageHint}
                        className="object-cover aspect-[4/3]"
                      />
                    </div>
                  )}
                  <CardTitle className="font-headline">{t.title}</CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button variant="ghost" asChild className="-ml-4">
                    <Link href={`/roadmap/${t.id}`}>
                      Bắt đầu học <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

    