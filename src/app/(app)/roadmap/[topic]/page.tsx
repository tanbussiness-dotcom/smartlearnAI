
'use client';

import { useState } from "react";
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
import { CheckCircle, Circle, PlayCircle, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Lesson = {
  id: string;
  title: string;
  status: "Learned" | "Learning" | "To Learn";
};

type Step = {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: "Learned" | "Learning" | "Locked";
  lessons: Lesson[];
};

const mockRoadmap: Step[] = [
  {
    id: "step1",
    stepNumber: 1,
    title: "Introduction to Python",
    description: "Learn the basic syntax and data structures of Python.",
    status: "Learned",
    lessons: [
      { id: "l1", title: "Python Syntax", status: "Learned" },
      { id: "l2", title: "Variables and Data Types", status: "Learned" },
    ],
  },
  {
    id: "step2",
    stepNumber: 2,
    title: "Control Flow",
    description: "Understand conditional statements and loops.",
    status: "Learning",
    lessons: [
      { id: "l3", title: "If-Else Statements", status: "Learned" },
      { id: "l4", title: "For and While Loops", status: "Learning" },
      { id: "l5", title: "Break and Continue", status: "To Learn" },
    ],
  },
  {
    id: "step3",
    stepNumber: 3,
    title: "Functions",
    description: "Learn to define and use functions.",
    status: "Locked",
    lessons: [
      { id: "l6", title: "Defining Functions", status: "To Learn" },
      { id: "l7", title: "Arguments and Return Values", status: "To Learn" },
    ],
  },
   {
    id: "step4",
    stepNumber: 4,
    title: "Data Structures",
    description: "Deep dive into lists, tuples, sets, and dictionaries.",
    status: "Locked",
    lessons: [
      { id: "l8", title: "Working with Lists", status: "To Learn" },
      { id: "l9", title: "Understanding Dictionaries", status: "To Learn" },
    ],
  },
];

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

const LessonList = ({ lessons }: { lessons: Lesson[] }) => (
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


export default function RoadmapPage({ params }: { params: { topic: string } }) {
  const topicTitle = decodeURIComponent(params.topic)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const completedSteps = mockRoadmap.filter(s => s.status === 'Learned').length;
  const progress = (completedSteps / mockRoadmap.length) * 100;
  
  const [activeStep, setActiveStep] = useState<string | undefined>(
    mockRoadmap.find(s => s.status === 'Learning')?.id
  );

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">{topicTitle}</CardTitle>
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
        <Accordion type="single" collapsible defaultValue={activeStep} onValueChange={setActiveStep} className="w-full space-y-8">
          {mockRoadmap.map((step) => (
            <div key={step.id} className="flex items-start gap-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border shadow-sm shrink-0">
                  {getStepIcon(step.status)}
              </div>
              <Card className="flex-1">
                  <AccordionItem value={step.id} className="border-b-0">
                      <AccordionTrigger className="p-6 hover:no-underline" disabled={step.status === 'Locked'}>
                          <div className="flex justify-between items-center w-full">
                              <div>
                                  <CardTitle className="font-headline text-left">{`Step ${step.stepNumber}: ${step.title}`}</CardTitle>
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
                                <LessonList lessons={step.lessons} />
                              </TabsContent>
                              <TabsContent value="To Learn">
                                <LessonList lessons={step.lessons.filter(l => l.status === 'To Learn')} />
                              </TabsContent>
                              <TabsContent value="Learning">
                                <LessonList lessons={step.lessons.filter(l => l.status === 'Learning')} />
                              </TabsContent>
                              <TabsContent value="Learned">
                                <LessonList lessons={step.lessons.filter(l => l.status === 'Learned')} />
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
