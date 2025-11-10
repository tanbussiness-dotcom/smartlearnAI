
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, LoaderCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, doc, setDoc } from 'firebase/firestore';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PopularTopics } from '@/components/popular-topics';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { vertexDynamicOutline } from '@/ai/flows/vertexDynamicOutline.flow';
import { useToast } from '@/hooks/use-toast';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [loading, setLoading] = useState(false);

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
      // Step 1: Generate Lesson Outline from AI
      const outlineResult = await vertexDynamicOutline({
        topic: currentTopic,
        level: 'beginner',
        targetAudience: 'self-learner',
      });
      
      if (!outlineResult) {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description:
            'The AI is currently busy. Please try again in a few moments.',
        });
        setLoading(false);
        return;
      }

      // Step 2: Create a single Lesson document in Firestore
      const lessonRef = doc(collection(firestore, 'users', user.uid, 'lessons'));
      const lessonId = lessonRef.id;

      const lessonData = {
        id: lessonId,
        title: outlineResult.title,
        overview: outlineResult.overview,
        outline: outlineResult.outline,
        sections: {}, // Initially empty, will be populated on demand
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        status: 'To Learn',
      };
      
      setDocumentNonBlocking(lessonRef, lessonData);
      
      toast({
        title: 'Lesson Outline Generated!',
        description: `Your lesson outline for "${currentTopic}" is ready.`,
      });

      router.push(`/lesson/${lessonId}`);
    } catch (error: any) {
      console.error('Failed to generate and store lesson outline:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description:
          error.message ||
          'There was an error generating your lesson outline. Please try again.',
      });
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
  );
}
