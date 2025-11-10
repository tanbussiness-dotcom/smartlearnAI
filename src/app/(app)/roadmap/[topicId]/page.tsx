
'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Circle, PlayCircle, Lock, LoaderCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useCollection, useUser, updateDocumentNonBlocking } from "@/firebase";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { collection, query, orderBy, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { generateLesson } from "@/ai/flows/lesson/generate-lesson";


type Lesson = {
  id: string;
  title: string;
  status: "Learned" | "Learning" | "To Learn";
  content?: string;
  topic: string;
  phase: string;
};

type Step = {
  id:string;
  stepNumber: number;
  stepTitle: string;
  description: string;
  status: "Learned" | "Learning" | "Locked";
  lessons: Lesson[];
};

const getStepIcon = (status: Step["status"]) => {
  switch (status) {
    case "Learned":
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    case "Learning":
      return <PlayCircle className="h-6 w-6 text-blue-500" />;
    case "Locked":
      return <Lock className="h-6 w-6 text-muted-foreground" />;
  }
};

const getLessonIcon = (status: Lesson["status"]) => {
  switch (status) {
    case "Learned":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "Learning":
      return <PlayCircle className="h-4 w-4 text-blue-500" />;
    case "To Learn":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

const lessonListVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const lessonItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
};

const LessonList = ({ lessons, onLessonClick }: { lessons: Lesson[], onLessonClick: (lesson: Lesson) => void }) => (
    <motion.ul className="space-y-3 pt-2" variants={lessonListVariants} initial="hidden" animate="visible">
        {lessons.length > 0 ? lessons.map(lesson => (
            <motion.li key={lesson.id} className="flex items-center" variants={lessonItemVariants}>
                <button onClick={() => onLessonClick(lesson)} className="flex-1 text-left">
                    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
                        {getLessonIcon(lesson.status)}
                        <span className={`flex-1 ${lesson.status === 'Learned' ? 'line-through text-muted-foreground' : ''}`}>
                            {lesson.title}
                        </span>
                    </div>
                </button>
            </motion.li>
        )) : (
            <motion.p className="text-sm text-muted-foreground text-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>No lessons in this category.</motion.p>
        )}
    </motion.ul>
);


export default function RoadmapPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [topicTitle, setTopicTitle] = useState('');
  const [roadmap, setRoadmap] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const roadmapsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !topicId) return null;
    return query(collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps'), orderBy('stepNumber'));
  }, [firestore, user, topicId]);

  const { data: roadmapsData, isLoading: isLoadingRoadmaps } = useCollection(roadmapsQuery);

  useEffect(() => {
    if(!firestore || !user?.uid || !topicId) return;

    const fetchTopicDetails = async () => {
        const topicRef = doc(firestore, 'users', user.uid, 'topics', topicId);
        const topicSnap = await getDoc(topicRef);
        if (topicSnap.exists()) {
            const title = topicSnap.data().title;
            setTopicTitle(title);
            document.title = `${title} | SmartLearn AI`;
        }
    };
    fetchTopicDetails();
  }, [firestore, user, topicId])

  useEffect(() => {
    const fetchAllLessons = async () => {
      if (!roadmapsData || !firestore || !user?.uid) return;
      setLoading(true);
      
      const newRoadmap: Step[] = await Promise.all(
        roadmapsData.map(async (stepData: any) => {
          const lessonsQuery = query(collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', stepData.id, 'lessons'));
          const lessonsSnapshot = await getDocs(lessonsQuery);
          const lessons = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
          
          return {
            id: stepData.id,
            stepNumber: stepData.stepNumber,
            stepTitle: stepData.stepTitle,
            description: stepData.description,
            status: stepData.status,
            lessons: lessons,
          };
        })
      );
      
      setRoadmap(newRoadmap);
      setLoading(false);
    };

    fetchAllLessons();
  }, [roadmapsData, firestore, user, topicId]);

  const handleLessonClick = useCallback(async (lesson: Lesson) => {
    if (!user || !firestore) return;

    const currentStep = roadmap.find(step => step.lessons.some(l => l.id === lesson.id));
    if (!currentStep) return;

    const lessonRef = doc(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', currentStep.id, 'lessons', lesson.id);

    // If lesson is "To Learn", change it to "Learning" and generate content
    if (lesson.status === 'To Learn') {
      updateDocumentNonBlocking(lessonRef, { status: 'Learning' });
      toast({
        title: 'Bắt đầu bài học mới!',
        description: 'AI đang tạo nội dung chi tiết cho bạn...',
      });

      // Check if content needs generation (e.g., placeholder content exists)
      const contentNeedsGeneration = !lesson.content || lesson.content.startsWith('Nội dung cho bài học này đang được AI tạo');
      if (contentNeedsGeneration) {
        try {
          const lessonResult = await generateLesson({
            topic: lesson.topic,
            phase: lesson.phase,
            userId: user.uid,
          });

          if (lessonResult && lessonResult.validation.valid) {
            await updateDoc(lessonRef, {
              ...lessonResult.lesson,
              createdAt: lessonResult.created_at,
            });
            toast({
              title: 'Nội dung đã sẵn sàng!',
              description: `Nội dung cho "${lesson.title}" đã được tạo.`,
            });
          } else {
            throw new Error('Lesson validation failed.');
          }
        } catch (error) {
          console.error("Failed to generate lesson content:", error);
          toast({
            variant: "destructive",
            title: "Lỗi tạo nội dung",
            description: "Đã có lỗi xảy ra khi AI tạo nội dung bài học. Vui lòng thử lại sau.",
          });
          // Revert status if generation fails
          updateDocumentNonBlocking(lessonRef, { status: 'To Learn' });
        }
      }
    }
    
    router.push(`/lesson/${lesson.id}`);

  }, [user, firestore, roadmap, topicId, toast, router]);


  const completedSteps = roadmap.filter(s => s.status === 'Learned').length;
  const progress = roadmap.length > 0 ? (completedSteps / roadmap.length) * 100 : 0;
  
  const [activeStep, setActiveStep] = useState<string | undefined>(
    roadmap.find(s => s.status === 'Learning')?.id
  );

  useEffect(() => {
    const learningStep = roadmap.find(s => s.status === 'Learning');
    if (learningStep) {
        setActiveStep(learningStep.id);
    } else if (roadmap.length > 0 && !activeStep) {
        const firstUnlearned = roadmap.find(s => s.status !== 'Learned');
        setActiveStep(firstUnlearned ? firstUnlearned.id : roadmap[0].id);
    }
  }, [roadmap, activeStep]);

  if (isLoadingRoadmaps || loading || !user) {
    return <div className="flex h-full w-full items-center justify-center"><LoaderCircle className="h-12 w-12 animate-spin text-primary" /></div>
  }

  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="container mx-auto py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">{topicTitle || 'Loading topic...'}</CardTitle>
            <CardDescription>Your personalized AI-generated learning path.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="w-full" />
              <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border -z-10"></div>
        <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="visible">
          <Accordion type="single" collapsible value={activeStep} onValueChange={setActiveStep} className="w-full space-y-8">
            {roadmap.map((step) => (
              <motion.div key={step.id} className="flex items-start gap-6" variants={itemVariants}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border shadow-sm shrink-0">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                      {getStepIcon(step.status)}
                    </motion.div>
                </div>
                <Card className="flex-1">
                    <AccordionItem value={step.id} className="border-b-0">
                        <AccordionTrigger className="p-6 hover:no-underline" disabled={step.status === 'Locked'}>
                            <div className="flex justify-between items-center w-full">
                                <div>
                                    <CardTitle className="font-headline text-left">{`Step ${step.stepNumber}: ${step.stepTitle}`}</CardTitle>
                                    <CardDescription className="mt-1 text-left">{step.description}</CardDescription>
                                </div>
                                  <div className="flex items-center gap-2 mr-4">
                                    {step.status === 'Learning' && <Badge variant="default">Current</Badge>}
                                    {step.status === 'Locked' && <Badge variant="outline">Locked</Badge>}
                                    {step.status === 'Learned' && <Badge variant="secondary">Completed</Badge>}
                                  </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                            <Tabs defaultValue="all">
                                <TabsList className="grid w-full grid-cols-4">
                                  <TabsTrigger value="all">All</TabsTrigger>
                                  <TabsTrigger value="To Learn">To Learn</TabsTrigger>
                                  <TabsTrigger value="Learning">Learning</TabsTrigger>
                                  <TabsTrigger value="Learned">Learned</TabsTrigger>
                                </TabsList>
                                <AnimatePresence mode="wait">
                                  <motion.div
                                    key={step.id + '-all'}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                  >
                                    <TabsContent value="all">
                                      <LessonList lessons={step.lessons} onLessonClick={handleLessonClick} />
                                    </TabsContent>
                                    <TabsContent value="To Learn">
                                      <LessonList lessons={step.lessons.filter(l => l.status === 'To Learn')} onLessonClick={handleLessonClick} />
                                    </TabsContent>
                                    <TabsContent value="Learning">
                                      <LessonList lessons={step.lessons.filter(l => l.status === 'Learning')} onLessonClick={handleLessonClick} />
                                    </TabsContent>
                                    <TabsContent value="Learned">
                                      <LessonList lessons={step.lessons.filter(l => l.status === 'Learned')} onLessonClick={handleLessonClick} />
                                    </TabsContent>
                                  </motion.div>
                                </AnimatePresence>
                              </Tabs>
                        </AccordionContent>
                    </AccordionItem>
                </Card>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </div>
  );
}
