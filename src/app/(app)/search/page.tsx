
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SearchIcon, ArrowRight, LoaderCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

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
import { useUser, useFirestore } from '@/firebase';
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

  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleGenerateRoadmap = async () => {
    if (!topic.trim()) {
      toast({
        variant: 'destructive',
        title: 'Topic is required',
        description: 'Please enter a topic to generate a roadmap.',
      });
      return;
    }
    if (!user) {
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
      const roadmapResult = await generatePersonalizedLearningRoadmap({ topic });

      // 2. Create Topic in Firestore
      const topicRef = await addDoc(collection(firestore, 'topics'), {
        title: topic,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      const topicId = topicRef.id;
      
      const batch = writeBatch(firestore);
      const allLessonsForTopic: { lessonId: string, title: string, description: string }[] = [];

      // 3. Generate and store lessons for each roadmap step
      for (const step of roadmapResult.roadmap) {
        const roadmapStepRef = collection(firestore, 'topics', topicId, 'roadmaps');
        const roadmapDocRef = await addDoc(roadmapStepRef, {
          ...step,
          status: step.stepNumber === 1 ? 'Learning' : 'Locked',
        });
        
        const lessonsResult = await generateLessonsForEachStep({
          stepTitle: step.stepTitle,
          stepDescription: step.description,
        });

        for (const lesson of lessonsResult) {
            const lessonRef = collection(firestore, 'topics', topicId, 'roadmaps', roadmapDocRef.id, 'lessons');
            const lessonDocRef = await addDoc(lessonRef, {
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
        const dailyTasksResult = await createDailyLearningTasks({
            lessons: allLessonsForTopic,
            userId: user.uid,
            topicId: topicId,
            tasksPerDay: 1, // Or make this configurable
        });

        for(const task of dailyTasksResult) {
            const taskRef = collection(firestore, 'users', user.uid, 'tasks');
            await addDoc(taskRef, { ...task, status: 'To Learn'});
        }
      }

      toast({
        title: 'Roadmap Generated!',
        description: `Your roadmap for "${topic}" is ready.`,
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
    } finally {
      setLoading(false);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenerateRoadmap();
  };


  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {popularTopics.map((topic) => (
            <Card
              key={topic.id}
              className="text-left hover:shadow-xl transition-shadow"
            >
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
              <CardFooter>
                <Button variant="ghost" asChild className="-ml-4">
                  <Link href={topic.href}>
                    Start Learning <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

