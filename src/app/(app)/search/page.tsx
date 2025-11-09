
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon, ArrowRight, LoaderCircle } from 'lucide-react';
import { collection, addDoc, writeBatch } from 'firebase/firestore';
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
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { generatePersonalizedLearningRoadmap } from '@/ai/flows/generate-personalized-learning-roadmap';
import { generateLessonsForEachStep } from '@/ai/flows/generate-lessons-for-each-step';
import { createDailyLearningTasks } from '@/ai/flows/create-daily-learning-tasks';
import { useToast } from '@/hooks/use-toast';


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
  const [loadingMessage, setLoadingMessage] = useState('Generating your personalized roadmap...');
  
  useEffect(() => {
    const topicFromUrl = searchParams.get('topic');
    if (topicFromUrl && !loading) {
      setTopic(topicFromUrl);
      handleGenerateRoadmap(topicFromUrl);
    }
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
    try {
      // 1. Generate Roadmap
      setLoadingMessage('Step 1 of 4: Generating your personalized roadmap...');
      const roadmapResult = await generatePersonalizedLearningRoadmap({ topic: currentTopic });

      // 2. Create Topic in Firestore
      setLoadingMessage('Step 2 of 4: Saving your new topic...');
      const topicRef = await addDocumentNonBlocking(collection(firestore, 'topics'), {
        title: currentTopic,
        createdBy: user.uid,
      });
      const topicId = topicRef.id;
      
      const allLessonsForTopic: { lessonId: string, title: string, description: string }[] = [];
      const totalSteps = roadmapResult.roadmap.length;

      // 3. Generate and store lessons for each roadmap step
      for (const [index, step] of roadmapResult.roadmap.entries()) {
        setLoadingMessage(`Step 3 of 4: Generating lessons for step ${index + 1}/${totalSteps}...`);
        
        const roadmapStepsCollection = collection(firestore, 'topics', topicId, 'roadmaps');
        const roadmapStepDoc = await addDocumentNonBlocking(roadmapStepsCollection, {
            ...step,
            status: step.stepNumber === 1 ? 'Learning' : 'Locked',
        });
        const roadmapStepId = roadmapStepDoc.id;

        const lessonsResult = await generateLessonsForEachStep({
          stepTitle: step.stepTitle,
          stepDescription: step.description,
        });

        const lessonsCollection = collection(firestore, 'topics', topicId, 'roadmaps', roadmapStepId, 'lessons');
        for (const lesson of lessonsResult) {
            const lessonDocRef = await addDocumentNonBlocking(lessonsCollection, {
                ...lesson,
                status: 'To Learn',
            });
            allLessonsForTopic.push({
                lessonId: lessonDocRef.id,
                title: lesson.title,
                description: lesson.description
            });
        }
      }
      
      // 4. Create daily tasks from all lessons
      if(allLessonsForTopic.length > 0) {
        setLoadingMessage('Step 4 of 4: Creating your daily learning tasks...');
        const dailyTasksResult = await createDailyLearningTasks({
            lessons: allLessonsForTopic,
            userId: user.uid,
            topicId: topicId,
            tasksPerDay: 1, // Or make this configurable
        });

        const tasksCollection = collection(firestore, 'users', user.uid, 'tasks');
        for(const task of dailyTasksResult) {
            addDocumentNonBlocking(tasksCollection, { ...task, status: 'To Learn'});
        }
      }

      toast({
        title: 'Roadmap Generated!',
        description: `Your roadmap for "${currentTopic}" is ready.`,
      });

      router.push(`/roadmap/${topicId}`);

    } catch (error) {
      console.error('Failed to generate and store roadmap:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description:
          'There was an error generating your learning roadmap. Please try again.',
      });
      setLoading(false);
    } 
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenerateRoadmap(topic);
  };
  
  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full p-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 100}}
            >
              <LoaderCircle className="h-16 w-16 animate-spin text-primary mb-6" />
            </motion.div>
            <motion.h2 
              className="text-2xl font-bold font-headline mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Crafting Your Learning Adventure...
            </motion.h2>
            <motion.p 
              className="text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {loadingMessage}
            </motion.p>
        </div>
    );
  }


  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center w-full h-full p-4"
    >
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline text-center mb-4">
          What do you want to learn today?
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Our AI will create a personalized roadmap just for you.
        </p>

        <form onSubmit={handleFormSubmit} className="relative mb-12">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="e.g., 'Learn Python from scratch' or 'Basics of cooking'"
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
              'Generate'
            )}
          </Button>
        </form>

        <h2 className="text-2xl font-bold font-headline mb-6">
          Or start with a popular topic
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
          {popularTopics.map((topic) => (
            <motion.div
              key={topic.id}
              variants={{
                hidden: { y: 20, opacity: 0 },
                visible: { y: 0, opacity: 1 },
              }}
            >
              <Card className="text-left hover:shadow-xl transition-shadow h-full flex flex-col">
                <CardHeader>
                  {topic.image && (
                    <div className="overflow-hidden rounded-lg mb-4">
                      <Image
                        src={topic.image.imageUrl}
                        alt={topic.title}
                        width={400}
                        height={300}
                        data-ai-hint={topic.image.imageHint}
                        className="object-cover aspect-[4/3]"
                      />
                    </div>
                  )}
                  <CardTitle className="font-headline">{topic.title}</CardTitle>
                  <CardDescription>{topic.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button variant="ghost" asChild className="-ml-4">
                    <Link href={`/roadmap/${topic.id}`}>
                      Start Learning <ArrowRight className="ml-2 h-4 w-4" />
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
