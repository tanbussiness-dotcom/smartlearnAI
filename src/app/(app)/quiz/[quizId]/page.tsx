"use client";

import { useState } from "react";
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
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";

const quizData = {
  title: "Variables and Data Types",
  questions: [
    {
      id: "q1",
      question: "Which of the following is the correct way to declare a variable in Python?",
      options: ["var x = 5", "x = 5", "variable x = 5", "int x = 5"],
      correctAnswer: "x = 5",
    },
    {
      id: "q2",
      question: "What is the data type of the following value: `10.5`?",
      options: ["int", "string", "float", "boolean"],
      correctAnswer: "float",
    },
    {
      id: "q3",
      question: "How can you get the data type of a variable `my_var`?",
      options: ["typeof(my_var)", "my_var.type()", "type(my_var)", "dataType(my_var)"],
      correctAnswer: "type(my_var)",
    },
    {
      id: "q4",
      question: "Which data type is used to store a sequence of characters?",
      options: ["char", "str", "string", "text"],
      correctAnswer: "str",
    },
    {
      id: "q5",
      question: "What will be the result of `bool(0)`?",
      options: ["True", "False", "0", "Error"],
      correctAnswer: "False",
    },
  ],
};

export default function QuizPage({ params }: { params: { quizId: string } }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

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
                    You scored {score} out of {quizData.questions.length} ({scorePercentage}%).
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
