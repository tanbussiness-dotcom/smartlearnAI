
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, ArrowRight, FileText, ChevronRight, LoaderCircle } from "lucide-react";
import { useFirestore, useUser, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, getDocs, updateDoc, writeBatch, getDoc, query, where, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React from "react";


const ResponsiveYoutubeEmbed = React.lazy(() => import('@/components/youtube-embed'));

type LessonInfo = {
    title: string;
    description: string;
    youtubeLink: string;
    instructions: string;
    userId: string;
    topicId: string;
    roadmapId: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.5,
};

export default function LessonPage({ params }: { params: { lessonId: string } }) {
  const { lessonId } = params;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [nextLesson, setNextLesson] = useState<{ id: string, title: string, stepTitle: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [embedId, setEmbedId] = useState<string | null>(null);
  const viewTracked = useRef(false);
  const startTime = useRef(Date.now());


  useEffect(() => {
    if (!firestore || !user || !lessonId) return;

    const fetchLessonDetails = async () => {
      setLoading(true);
      try {
        const topicsSnapshot = await getDocs(collection(firestore, 'users', user.uid, 'topics'));
        let found = false;

        for (const topicDoc of topicsSnapshot.docs) {
          const roadmapsSnapshot = await getDocs(collection(firestore, 'users', user.uid, 'topics', topicDoc.id, 'roadmaps'));
          for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonRef = doc(firestore, 'users', user.uid, 'topics', topicDoc.id, 'roadmaps', roadmapDoc.id, 'lessons', lessonId);
            const lessonSnap = await getDoc(lessonRef);
            
            if (lessonSnap.exists()) {
              const lessonData = lessonSnap.data();
              const fetchedLesson = {
                title: lessonData.title,
                description: lessonData.description,
                youtubeLink: lessonData.youtubeLink,
                instructions: lessonData.instructions,
                userId: user.uid,
                topicId: topicDoc.id,
                roadmapId: roadmapDoc.id,
              };
              setLesson(fetchedLesson);
              setEmbedId(getYoutubeEmbedId(fetchedLesson.youtubeLink));

              
              // Find next lesson
              const lessonsInStepQuery = query(collection(firestore, 'users', user.uid, 'topics', topicDoc.id, 'roadmaps', roadmapDoc.id, 'lessons'));
              const lessonsInStepSnapshot = await getDocs(lessonsInStepQuery);
              const allLessonsInStep = lessonsInStepSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
              const currentIndex = allLessonsInStep.findIndex(l => l.id === lessonId);
              
              if (currentIndex < allLessonsInStep.length - 1) {
                  const nextLessonData = allLessonsInStep[currentIndex + 1];
                  const stepSnap = await getDoc(roadmapDoc.ref);
                  setNextLesson({ id: nextLessonData.id, title: nextLessonData.title, stepTitle: stepSnap.data()?.stepTitle || 'Next Step' });
              } else {
                  // If it's the last lesson in the step, find the next step and its first lesson
                  const currentStepSnap = await getDoc(roadmapDoc.ref);
                  const currentStepNumber = currentStepSnap.data()?.stepNumber;

                  if (currentStepNumber) {
                      const roadmapsInTopicRef = collection(firestore, 'users', user.uid, 'topics', topicDoc.id, 'roadmaps');
                      const nextStepQuery = query(roadmapsInTopicRef, where("stepNumber", "==", currentStepNumber + 1), limit(1));
                      const nextStepSnapshot = await getDocs(nextStepQuery);
                      
                      if (!nextStepSnapshot.empty) {
                          const nextStepDoc = nextStepSnapshot.docs[0];
                          const nextStepLessonsQuery = query(collection(firestore, nextStepDoc.ref, 'lessons'), limit(1));
                          const nextStepLessonsSnapshot = await getDocs(nextStepLessonsQuery);
                          if (!nextStepLessonsSnapshot.empty) {
                              const firstLessonOfNextStep = nextStepLessonsSnapshot.docs[0];
                              setNextLesson({ id: firstLessonOfNextStep.id, title: firstLessonOfNextStep.data().title, stepTitle: nextStepDoc.data().stepTitle });
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
        console.error("Error fetching lesson:", error);
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
      const lessonRef = doc(firestore, 'users', lesson.userId, 'topics', lesson.topicId, 'roadmaps', lesson.roadmapId, 'lessons', lessonId);
      updateDocumentNonBlocking(lessonRef, {
        status: "Learned"
      });
      toast({ title: 'Lesson Completed!', description: 'Great job! Your progress has been updated.' });
    } catch (error) {
        console.error("Error updating lesson status:", error);
        toast({ variant: 'destructive', title: 'Oops!', description: 'Could not update your progress. Please try again.' });
    } finally {
        setIsCompleting(false);
    }
  };
  
  if (loading) {
      return (
          <div className="flex items-center justify-center min-h-full py-12">
              <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
          </div>
      )
  }

  if (!lesson) {
      return (
          <div className="flex items-center justify-center min-h-full py-12">
             <p className="text-muted-foreground">Lesson not found.</p>
          </div>
      )
  }

  const getYoutubeEmbedId = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            return urlObj.searchParams.get('v');
        }
    } catch (e) {
        // invalid url, just return it
    }
    return 'Z1Yd7upQsXY'; // default fallback
  }

  return (
    <motion.div 
        className="container mx-auto max-w-5xl py-8"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
    >
        <div className="mb-6">
            <h1 className="text-4xl font-extrabold font-headline tracking-tight">{lesson.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{lesson.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card className="overflow-hidden">
                    <Suspense fallback={<div className="aspect-video w-full bg-muted animate-pulse" />}>
                        {embedId && <ResponsiveYoutubeEmbed embedId={embedId} />}
                    </Suspense>
                </Card>

                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <FileText className="h-5 w-5" />
                            Lesson Instructions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: lesson.instructions || '' }}
                    >
                    </CardContent>
                </Card>
            </div>
            
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Complete Lesson</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">Once you've watched the video and practiced the concepts, mark this lesson as complete.</p>
                        <Button className="w-full" onClick={handleMarkAsComplete} disabled={isCompleting}>
                            <AnimatePresence mode="wait">
                                {isCompleting ? (
                                    <motion.span key="loading" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                    </motion.span>
                                ) : (
                                    <motion.span key="check" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                                        <Check className="mr-2 h-4 w-4"/>
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            Mark as Completed
                        </Button>
                    </CardContent>
                </Card>
                
                <Card className="bg-primary/10 border-primary">
                    <CardHeader>
                        <CardTitle className="font-headline">Take the Quiz</CardTitle>
                        <CardDescription>
                            Pass the quiz to test your knowledge and unlock the next lesson.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full" asChild>
                            <Link href={`/quiz/${params.lessonId}`}>
                                Start Quiz
                                <ArrowRight className="ml-2 h-4 w-4"/>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                
                {nextLesson && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-lg">Next Lesson</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link href={`/lesson/${nextLesson.id}`} className="group">
                                <div className="flex justify-between items-center p-3 hover:bg-muted rounded-md transition-colors">
                                    <div>
                                        <p className="font-medium">{nextLesson.title}</p>
                                        <p className="text-sm text-muted-foreground">{nextLesson.stepTitle}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform"/>
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
