
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, ArrowRight, LoaderCircle } from 'lucide-react';
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
import { createDailyLearningTasks } from '@/ai/flows/create-daily-learning-tasks';
import { syncRoadmapToFirestore } from '@/ai/flows/syncRoadmapToFirestore.flow';
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
      
      // Step 3: Use the new flow to sync the entire roadmap to Firestore
      setLoadingStep('validate'); // Corresponds to "Validating lessons"
      const syncResult = await syncRoadmapToFirestore({
        userId: user.uid,
        topicId: topicId,
        roadmapData: roadmapResult,
      });

      if (!syncResult.success) {
        throw new Error(syncResult.message || 'Failed to sync roadmap to Firestore.');
      }
      
      // Step 4: Create daily tasks (optional, can be done in background)
      // This part can be adjusted based on whether you want to create tasks from all lessons at once.
      // For now, we assume this is a desired feature.
      setLoadingStep('save');
      const allLessonsForDailyTasks = roadmapResult.roadmap.flatMap(phase => 
        phase.lessons.map(lesson => ({
          lessonId: lesson.lessonId,
          title: lesson.title,
          description: lesson.description
        }))
      );

      if (allLessonsForDailyTasks.length > 0) {
        // This can be a non-blocking call if we don't need to wait for it.
        createDailyLearningTasks({
            lessons: allLessonsForDailyTasks,
            userId: user.uid,
            topicId: topicId,
            tasksPerDay: 1,
        }).catch(error => console.error("Failed to create daily tasks:", error));
      }

      toast({
        title: 'Roadmap Generated!',
        description: `Your roadmap for "${currentTopic}" is ready.`,
      });

      router.push(`/roadmap/${topicId}`);

    } catch (error) {
      console.error('Failed to generate and store roadmap:', error);
      
      if (error instanceof Error && error.message.includes('server-side Firestore permission error')) {
        toast({
          variant: 'destructive',
          title: 'Server Error',
          description: "A permission error occurred on the server while generating the lesson. Please check server logs and Firestore rules.",
        });
      } else if (!(error instanceof FirestorePermissionError)) {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: 'There was an error generating your learning roadmap. Please try again.',
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
