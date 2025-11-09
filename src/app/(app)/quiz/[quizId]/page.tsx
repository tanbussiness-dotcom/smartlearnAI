
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle, XCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { useFirestore, useUser, useCollection } from "@/firebase";
import { collection, doc, addDoc, getDocs, query, limit } from "firebase/firestore";
import { generateQuizzesForKnowledgeAssessment } from "@/ai/flows/generate-quizzes-for-knowledge-assessment";
import { useToast } from "@/hooks/use-toast";

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
};

type QuizData = {
  id: string;
  title: string;
  questions: QuizQuestion[];
};

export default function QuizPage({ params }: { params: { quizId: string } }) { // quizId is lessonId
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchOrCreateQuiz = async () => {
      setLoading(true);
      try {
        const lessonId = params.quizId;
        const testsRef = collection(firestore, 'lessons', lessonId, 'tests');
        const q = query(testsRef, limit(1));
        const existingTestSnapshot = await getDocs(q);

        if (!existingTestSnapshot.empty) {
          const testDoc = existingTestSnapshot.docs[0];
          const testData = testDoc.data();
          setQuizData({
            id: testDoc.id,
            title: "Knowledge Check", // Title can be fetched from lesson if needed
            questions: testData.questions.map((q: any, index: number) => ({ ...q, id: `q${index}` })),
          });
        } else {
          // No test found, so generate one
          // We need lesson details to generate a good quiz
          // This requires fetching the lesson details. For simplicity, we'll use placeholder data.
          // In a real app, you'd fetch lesson title and description first.
          toast({ title: 'Generating a new quiz...', description: 'This may take a moment.' });
          
          const quizResult = await generateQuizzesForKnowledgeAssessment({
            lessonId: lessonId,
            topic: "General Knowledge", // Placeholder
            stepTitle: "First Step", // Placeholder
            lessonTitle: "A New Lesson", // Placeholder
            lessonDescription: "This is a new lesson.", // Placeholder
          });
          
          const newQuiz = quizResult.quiz;

          const newTestDocRef = await addDoc(testsRef, {
            lessonId: lessonId,
            questions: newQuiz.questions,
            createdBy: user.uid,
          });

          setQuizData({
            id: newTestDocRef.id,
            title: "Knowledge Check",
            questions: newQuiz.questions.map((q, index) => ({ ...q, id: `q${index}` })),
          });
        }
      } catch (error) {
        console.error("Error fetching or creating quiz:", error);
        toast({ variant: 'destructive', title: 'Failed to load quiz', description: 'Please try again later.' });
      } finally {
        setLoading(false);
      }
    };

    fetchOrCreateQuiz();
  }, [firestore, user, params.quizId, toast]);


  if (loading || !quizData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Quiz...</p>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
  
  const handleNext = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
        setShowResult(true);
    }
  };

  const handleOptionChange = (value: string) => {
    setSelectedAnswers({
        ...selectedAnswers,
        [currentQuestion.id]: value
    });
  };

  const score = quizData.questions.reduce((acc, q) => {
      return selectedAnswers[q.id] === q.correctAnswer ? acc + 1 : acc;
  }, 0);
  const scorePercentage = (score / quizData.questions.length) * 100;
  const passed = scorePercentage >= 80;


  return (
    <div className="flex items-center justify-center min-h-full py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="text-sm text-muted-foreground">Quiz</p>
          <CardTitle className="font-headline">{quizData.title}</CardTitle>
          <CardDescription>Test your knowledge to unlock the next step.</CardDescription>
          <div className="pt-4">
            <div className="flex justify-between mb-1">
                <span className="text-sm">Question {currentQuestionIndex + 1} of {quizData.questions.length}</span>
                <span className="text-sm">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="font-medium text-lg">{currentQuestion.question}</p>
            <RadioGroup onValueChange={handleOptionChange} value={selectedAnswers[currentQuestion.id]}>
              {currentQuestion.options.map((option) => (
                <div key={option} className="flex items-center space-x-2 p-3 rounded-lg border has-[[data-state=checked]]:bg-muted">
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleNext} className="w-full md:w-auto ml-auto" disabled={!selectedAnswers[currentQuestion.id]}>
            {currentQuestionIndex < quizData.questions.length - 1 ? "Next Question" : "Submit Quiz"}
            <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showResult} onOpenChange={setShowResult}>
        <AlertDialogContent>
            <AlertDialogHeader className="items-center text-center">
                {passed ? <CheckCircle className="h-16 w-16 text-green-500 mb-2"/> : <XCircle className="h-16 w-16 text-destructive mb-2"/>}
                <AlertDialogTitle className="text-2xl font-headline">
                    {passed ? "Congratulations! You Passed!" : "Almost there!"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                    You scored {score} out of {quizData.questions.length} ({scorePercentage.toFixed(0)}%).
                    <br/>
                    {passed ? "You've unlocked the next lesson." : "You need 80% to pass. Please try again."}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                {passed ? (
                    <AlertDialogAction asChild className="w-full">
                       <Link href="/roadmap/python">Continue to Next Lesson</Link>
                    </AlertDialogAction>
                ) : (
                    <AlertDialogAction onClick={() => { setShowResult(false); setCurrentQuestionIndex(0); setSelectedAnswers({}); }} className="w-full">
                        Retry Quiz
                    </AlertDialogAction>
                )}
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
