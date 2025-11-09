
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, ArrowRight, FileText, ChevronRight, LoaderCircle } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, getDocs, updateDoc, writeBatch, getDoc, query, where, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const ResponsiveYoutubeEmbed = ({ embedId }: { embedId: string }) => (
  <div className="relative overflow-hidden w-full" style={{ paddingTop: "56.25%" }}>
    <iframe
      className="absolute top-0 left-0 bottom-0 right-0 w-full h-full"
      src={`https://www.youtube.com/embed/${embedId}`}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="Embedded youtube"
    />
  </div>
);

type LessonInfo = {
    title: string;
    description: string;
    youtubeLink: string;
    instructions: string;
    topicId: string;
    roadmapId: string;
}

export default function LessonPage({ params }: { params: { lessonId: string } }) {
  const { lessonId } = params;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [nextLesson, setNextLesson] = useState<{ id: string, title: string, stepTitle: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!firestore || !lessonId) return;

    const fetchLessonDetails = async () => {
      setLoading(true);
      try {
        const topicsSnapshot = await getDocs(collection(firestore, 'topics'));
        let found = false;

        for (const topicDoc of topicsSnapshot.docs) {
          const roadmapsSnapshot = await getDocs(collection(firestore, 'topics', topicDoc.id, 'roadmaps'));
          for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonRef = doc(firestore, 'topics', topicDoc.id, 'roadmaps', roadmapDoc.id, 'lessons', lessonId);
            const lessonSnap = await getDoc(lessonRef);
            
            if (lessonSnap.exists()) {
              const lessonData = lessonSnap.data();
              setLesson({
                title: lessonData.title,
                description: lessonData.description,
                youtubeLink: lessonData.youtubeLink,
                instructions: lessonData.instructions,
                topicId: topicDoc.id,
                roadmapId: roadmapDoc.id,
              });
              
              // Find next lesson
              const lessonsInStepQuery = query(collection(firestore, 'topics', topicDoc.id, 'roadmaps', roadmapDoc.id, 'lessons'));
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
                      const roadmapsInTopicRef = collection(firestore, 'topics', topicDoc.id, 'roadmaps');
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
  }, [firestore, lessonId, toast]);

  const handleMarkAsComplete = async () => {
    if (!firestore || !lesson) return;
    setIsCompleting(true);
    try {
      const lessonRef = doc(firestore, 'topics', lesson.topicId, 'roadmaps', lesson.roadmapId, 'lessons', lessonId);
      await updateDoc(lessonRef, {
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

  const getYoutubeEmbedId = (url: string) => {
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
    <div className="container mx-auto max-w-5xl py-8">
        <div className="mb-6">
            <h1 className="text-4xl font-extrabold font-headline tracking-tight">{lesson.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{lesson.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card className="overflow-hidden">
                    <ResponsiveYoutubeEmbed embedId={getYoutubeEmbedId(lesson.youtubeLink) || ''} />
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
                            {isCompleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4"/>}
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
    </div>
  );
}

    