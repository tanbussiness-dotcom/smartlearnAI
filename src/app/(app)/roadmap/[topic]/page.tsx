
'use client';

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
import { useCollection } from "@/firebase";
import { useFirestore } from "@/firebase/provider";
import { collection, query, orderBy } from "firebase/firestore";

type Lesson = {
  id: string;
  title: string;
  status: "Learned" | "Learning" | "To Learn";
};

type Step = {
  id: string;
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

const LessonList = ({ lessons, topicId, roadmapId }: { lessons: Lesson[], topicId: string, roadmapId: string }) => (
    <ul className="space-y-3 pt-2">
        {lessons.length > 0 ? lessons.map(lesson => (
            <li key={lesson.id} className="flex items-center">
                <Link href={`/lesson/${lesson.id}`} className="flex-1">
                    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
                        {getLessonIcon(lesson.status)}
                        <span className={`flex-1 ${lesson.status === 'Learned' ? 'line-through text-muted-foreground' : ''}`}>
                            {lesson.title}
                        </span>
                    </div>
                </Link>
            </li>
        )) : (
            <p className="text-sm text-muted-foreground text-center py-4">No lessons in this category.</p>
        )}
    </ul>
);


export default function RoadmapPage({ params }: { params: { topic: string } }) { // topic is now topicId
  const firestore = useFirestore();
  const topicId = params.topic;

  const [topicTitle, setTopicTitle] = useState('');
  const [roadmap, setRoadmap] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const roadmapsQuery = useMemo(() => {
    if (!firestore || !topicId) return null;
    return query(collection(firestore, 'topics', topicId, 'roadmaps'), orderBy('stepNumber'));
  }, [firestore, topicId]);

  const { data: roadmapsData, isLoading: isLoadingRoadmaps } = useCollection(roadmapsQuery);

  useEffect(() => {
    if(!firestore || !topicId) return;

    const fetchTopicDetails = async () => {
        const topicRef = doc(firestore, 'topics', topicId);
        const topicSnap = await getDoc(topicRef);
        if (topicSnap.exists()) {
            setTopicTitle(topicSnap.data().title);
        }
    };
    fetchTopicDetails();
  }, [firestore, topicId])

  useEffect(() => {
    const fetchAllLessons = async () => {
      if (!roadmapsData || !firestore) return;
      setLoading(true);
      
      const newRoadmap: Step[] = await Promise.all(
        roadmapsData.map(async (stepData: any) => {
          const lessonsQuery = query(collection(firestore, 'topics', topicId, 'roadmaps', stepData.id, 'lessons'));
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
  }, [roadmapsData, firestore, topicId]);

  const completedSteps = roadmap.filter(s => s.status === 'Learned').length;
  const progress = roadmap.length > 0 ? (completedSteps / roadmap.length) * 100 : 0;
  
  const [activeStep, setActiveStep] = useState<string | undefined>(
    roadmap.find(s => s.status === 'Learning')?.id
  );

  useEffect(() => {
    const learningStep = roadmap.find(s => s.status === 'Learning');
    if (learningStep) {
        setActiveStep(learningStep.id);
    }
  }, [roadmap]);

  if (isLoadingRoadmaps || loading) {
    return <div className="flex h-full w-full items-center justify-center"><LoaderCircle className="h-12 w-12 animate-spin text-primary" /></div>
  }

  return (
    <div className="container mx-auto py-8">
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
      
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border -z-10"></div>
        <div className="space-y-8">
        <Accordion type="single" collapsible value={activeStep} onValueChange={setActiveStep} className="w-full space-y-8">
          {roadmap.map((step) => (
            <div key={step.id} className="flex items-start gap-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border shadow-sm shrink-0">
                  {getStepIcon(step.status)}
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
                              <TabsContent value="all">
                                <LessonList lessons={step.lessons} topicId={topicId} roadmapId={step.id} />
                              </TabsContent>
                              <TabsContent value="To Learn">
                                <LessonList lessons={step.lessons.filter(l => l.status === 'To Learn')} topicId={topicId} roadmapId={step.id} />
                              </TabsContent>
                              <TabsContent value="Learning">
                                <LessonList lessons={step.lessons.filter(l => l.status === 'Learning')} topicId={topicId} roadmapId={step.id} />
                              </TabsContent>
                              <TabsContent value="Learned">
                                <LessonList lessons={step.lessons.filter(l => l.status === 'Learned')} topicId={topicId} roadmapId={step.id} />
                              </TabsContent>
                            </Tabs>
                      </AccordionContent>
                  </AccordionItem>
              </Card>
            </div>
          ))}
        </Accordion>
        </div>
      </div>
    </div>
  );
}

    