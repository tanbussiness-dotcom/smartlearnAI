
'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Check,
  ArrowRight,
  ChevronRight,
  LoaderCircle,
  Clock,
  BookOpen,
  Link as LinkIcon,
  Bot,
  Youtube,
  Star,
} from 'lucide-react';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  getDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import React from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { format } from 'date-fns';

const ResponsiveYoutubeEmbed = React.lazy(
  () => import('@/components/youtube-embed')
);

type Source = {
  title: string;
  url: string;
  domain: string;
  type: 'article' | 'doc' | 'video' | 'tutorial';
  short_note: string;
  relevance?: number; // Kept for compatibility, can be displayed as trust_score
};

type LessonInfo = {
  title: string;
  description: string; // Used as summary
  youtubeLink?: string; // Legacy
  instructions?: string; // Legacy
  synthesized_content: string;
  estimated_time_min: number;
  sources: Source[];
  video_links: string[];
  userId: string;
  topicId: string;
  roadmapId: string;
  createdAt: string; // ISO date string
  isAiGenerated: boolean;
};

const getYoutubeEmbedId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (
      urlObj.hostname === 'www.youtube.com' ||
      urlObj.hostname === 'youtube.com'
    ) {
      return urlObj.searchParams.get('v');
    }
  } catch (e) {
    // invalid url, just return it
  }
  return 'Z1Yd7upQsXY'; // default fallback
};

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.lessonId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [nextLesson, setNextLesson] = useState<{
    id: string;
    title: string;
    stepTitle: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!firestore || !user || !lessonId) return;

    const fetchLessonDetails = async () => {
      setLoading(true);
      try {
        const topicsSnapshot = await getDocs(
          collection(firestore, 'users', user.uid, 'topics')
        );
        let found = false;

        for (const topicDoc of topicsSnapshot.docs) {
          const roadmapsSnapshot = await getDocs(
            collection(
              firestore,
              'users',
              user.uid,
              'topics',
              topicDoc.id,
              'roadmaps'
            )
          );
          for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonRef = doc(
              firestore,
              'users',
              user.uid,
              'topics',
              topicDoc.id,
              'roadmaps',
              roadmapDoc.id,
              'lessons',
              lessonId
            );
            const lessonSnap = await getDoc(lessonRef);

            if (lessonSnap.exists()) {
              const lessonData = lessonSnap.data();
              const fetchedLesson: LessonInfo = {
                title: lessonData.title,
                description: lessonData.summary || lessonData.description,
                synthesized_content:
                  lessonData.synthesized_content || lessonData.instructions,
                estimated_time_min: lessonData.estimated_time_min || 15,
                sources: lessonData.sources || [],
                video_links: lessonData.video_links || [],
                userId: user.uid,
                topicId: topicDoc.id,
                roadmapId: roadmapDoc.id,
                createdAt: lessonData.createdAt
                  ? lessonData.createdAt.toDate().toISOString()
                  : new Date().toISOString(),
                isAiGenerated: !!lessonData.synthesized_content, // Simple check
                youtubeLink: lessonData.youtubeLink,
              };

              // If legacy youtubeLink exists and no video_links, add it.
              if (
                fetchedLesson.youtubeLink &&
                fetchedLesson.video_links.length === 0
              ) {
                fetchedLesson.video_links.push(fetchedLesson.youtubeLink);
              }

              setLesson(fetchedLesson);

              // Find next lesson logic...
              const lessonsInStepQuery = query(
                collection(
                  firestore,
                  'users',
                  user.uid,
                  'topics',
                  topicDoc.id,
                  'roadmaps',
                  roadmapDoc.id,
                  'lessons'
                )
              );
              const lessonsInStepSnapshot = await getDocs(lessonsInStepQuery);
              const allLessonsInStep = lessonsInStepSnapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));
              const currentIndex = allLessonsInStep.findIndex(
                (l) => l.id === lessonId
              );

              if (currentIndex < allLessonsInStep.length - 1) {
                const nextLessonData = allLessonsInStep[currentIndex + 1];
                const stepSnap = await getDoc(roadmapDoc.ref);
                setNextLesson({
                  id: nextLessonData.id,
                  title: nextLessonData.title,
                  stepTitle: stepSnap.data()?.stepTitle || 'Next Step',
                });
              } else {
                const currentStepSnap = await getDoc(roadmapDoc.ref);
                const currentStepNumber = currentStepSnap.data()?.stepNumber;

                if (currentStepNumber) {
                  const roadmapsInTopicRef = collection(
                    firestore,
                    'users',
                    user.uid,
                    'topics',
                    topicDoc.id,
                    'roadmaps'
                  );
                  const nextStepQuery = query(
                    roadmapsInTopicRef,
                    where('stepNumber', '==', currentStepNumber + 1),
                    limit(1)
                  );
                  const nextStepSnapshot = await getDocs(nextStepQuery);

                  if (!nextStepSnapshot.empty) {
                    const nextStepDoc = nextStepSnapshot.docs[0];
                    const nextStepLessonsQuery = query(
                      collection(nextStepDoc.ref, 'lessons'),
                      limit(1)
                    );
                    const nextStepLessonsSnapshot = await getDocs(
                      nextStepLessonsQuery
                    );
                    if (!nextStepLessonsSnapshot.empty) {
                      const firstLessonOfNextStep =
                        nextStepLessonsSnapshot.docs[0];
                      setNextLesson({
                        id: firstLessonOfNextStep.id,
                        title: firstLessonOfNextStep.data().title,
                        stepTitle: nextStepDoc.data().stepTitle,
                      });
                    }
                  }
                }
              }

              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          toast({ variant: 'destructive', title: 'Lesson not found.' });
        }
      } catch (error) {
        console.error('Error fetching lesson:', error);
        toast({ variant: 'destructive', title: 'Failed to load lesson.' });
      } finally {
        setLoading(false);
      }
    };

    fetchLessonDetails();
  }, [firestore, user, lessonId, toast]);

  const handleMarkAsComplete = async () => {
    if (!firestore || !lesson) return;
    setIsCompleting(true);
    try {
      const lessonRef = doc(
        firestore,
        'users',
        lesson.userId,
        'topics',
        lesson.topicId,
        'roadmaps',
        lesson.roadmapId,
        'lessons',
        lessonId
      );
      await updateDoc(lessonRef, {
        status: 'Learned',
      });
      toast({
        title: 'Lesson Completed!',
        description: 'Great job! Your progress has been updated.',
      });
    } catch (error) {
      console.error('Error updating lesson status:', error);
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not update your progress. Please try again.',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full py-12">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex items-center justify-center min-h-full py-12">
        <p className="text-muted-foreground">Lesson not found.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="container mx-auto max-w-5xl py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight">
          {lesson.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {lesson.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{lesson.estimated_time_min} min read</span>
          </div>
          {lesson.isAiGenerated && (
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span>AI Generated</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span>
              Created on {format(new Date(lesson.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {lesson.video_links && lesson.video_links.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                  <Youtube className="h-5 w-5 text-red-500" />
                  Watch & Learn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lesson.video_links.map((link, index) => {
                    const embedId = getYoutubeEmbedId(link);
                    return embedId ? (
                      <Suspense
                        key={index}
                        fallback={
                          <div className="aspect-video w-full bg-muted animate-pulse rounded-lg" />
                        }
                      >
                        <div className="overflow-hidden rounded-lg border">
                          <ResponsiveYoutubeEmbed embedId={embedId} />
                        </div>
                      </Suspense>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <BookOpen className="h-5 w-5" />
                Lesson Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReactMarkdown
                className="prose dark:prose-invert max-w-none"
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {lesson.synthesized_content}
              </ReactMarkdown>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Complete Lesson</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once you've finished the material, mark this lesson as
                complete.
              </p>
              <Button
                className="w-full"
                onClick={handleMarkAsComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Mark as Completed
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary">
            <CardHeader>
              <CardTitle className="font-headline">Take the Quiz</CardTitle>
              <CardDescription>
                Test your knowledge and unlock the next lesson.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href={`/quiz/${lessonId}`}>
                  Start Quiz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {lesson.sources && lesson.sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  Sources & Further Reading
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lesson.sources.map((source, index) => (
                  <div key={index}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {source.title}
                    </a>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3"/>{source.domain}</span>
                      {source.relevance && (
                         <span className="flex items-center gap-1"><Star className="h-3 w-3"/>Trust: {(source.relevance * 100).toFixed(0)}%</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 italic">
                      "{source.short_note}"
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {nextLesson && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  Next Lesson
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/lesson/${nextLesson.id}`} className="group">
                  <div className="flex justify-between items-center p-3 hover:bg-muted rounded-md transition-colors">
                    <div>
                      <p className="font-medium">{nextLesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {nextLesson.stepTitle}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
