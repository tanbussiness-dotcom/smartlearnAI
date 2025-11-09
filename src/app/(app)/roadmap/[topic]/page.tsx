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
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, PlayCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Lesson = {
  id: string;
  title: string;
  status: "learned" | "learning" | "to-learn";
};

type Step = {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: "learned" | "learning" | "locked";
  lessons: Lesson[];
};

const mockRoadmap: Step[] = [
  {
    id: "step1",
    stepNumber: 1,
    title: "Introduction to Python",
    description: "Learn the basic syntax and data structures of Python.",
    status: "learned",
    lessons: [
      { id: "l1", title: "Python Syntax", status: "learned" },
      { id: "l2", title: "Variables and Data Types", status: "learned" },
    ],
  },
  {
    id: "step2",
    stepNumber: 2,
    title: "Control Flow",
    description: "Understand conditional statements and loops.",
    status: "learning",
    lessons: [
      { id: "l3", title: "If-Else Statements", status: "learned" },
      { id: "l4", title: "For and While Loops", status: "learning" },
      { id: "l5", title: "Break and Continue", status: "to-learn" },
    ],
  },
  {
    id: "step3",
    stepNumber: 3,
    title: "Functions",
    description: "Learn to define and use functions.",
    status: "locked",
    lessons: [
      { id: "l6", title: "Defining Functions", status: "to-learn" },
      { id: "l7", title: "Arguments and Return Values", status: "to-learn" },
    ],
  },
   {
    id: "step4",
    stepNumber: 4,
    title: "Data Structures",
    description: "Deep dive into lists, tuples, sets, and dictionaries.",
    status: "locked",
    lessons: [
      { id: "l8", title: "Working with Lists", status: "to-learn" },
      { id: "l9", title: "Understanding Dictionaries", status: "to-learn" },
    ],
  },
];

const getStepIcon = (status: Step["status"]) => {
  switch (status) {
    case "learned":
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    case "learning":
      return <PlayCircle className="h-6 w-6 text-blue-500" />;
    case "locked":
      return <Circle className="h-6 w-6 text-muted-foreground" />;
  }
};

const getLessonIcon = (status: Lesson["status"]) => {
  switch (status) {
    case "learned":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "learning":
      return <PlayCircle className="h-4 w-4 text-blue-500" />;
    case "to-learn":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};


export default function RoadmapPage({ params }: { params: { topic: string } }) {
  const topicTitle = decodeURIComponent(params.topic)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const completedSteps = mockRoadmap.filter(s => s.status === 'learned').length;
  const progress = (completedSteps / mockRoadmap.length) * 100;

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
        {mockRoadmap.map((step) => (
          <div key={step.id} className="flex items-start gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border shadow-sm shrink-0">
                {getStepIcon(step.status)}
            </div>
            <Card className="flex-1">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-headline">{`Step ${step.stepNumber}: ${step.title}`}</CardTitle>
                            <CardDescription className="mt-1">{step.description}</CardDescription>
                        </div>
                        {step.status === 'learning' && <Badge variant="default">Current</Badge>}
                        {step.status === 'locked' && <Badge variant="outline">Locked</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible disabled={step.status === 'locked'}>
                        <AccordionItem value="lessons" className="border-none">
                            <AccordionTrigger>Show Lessons</AccordionTrigger>
                            <AccordionContent>
                                <ul className="space-y-3 pt-2">
                                    {step.lessons.map(lesson => (
                                        <li key={lesson.id} className="flex items-center">
                                            <Link href={`/lesson/${lesson.id}`} className="flex-1">
                                                <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
                                                    {getLessonIcon(lesson.status)}
                                                    <span className={`flex-1 ${lesson.status === 'learned' ? 'line-through text-muted-foreground' : ''}`}>
                                                        {lesson.title}
                                                    </span>
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
