
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
import { useFirestore, useUser, useAnalytics } from "@/firebase";
import { collection, doc, addDoc, getDocs, query, limit, getDoc, writeBatch, where } from "firebase/firestore";
import { generateQuizzesForKnowledgeAssessment } from "@/ai/flows/generate-quizzes-for-knowledge-assessment";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { trackQuizStart, trackQuizCompletion } from "@/lib/analytics";


type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
};

type QuizData = {
  id: string;
  topicId: string;
  roadmapId: string;
  title: string;
  questions: QuizQuestion[];
};

export default function QuizPage({ params }: { params: { quizId: string } }) { // quizId is lessonId
  const firestore = useFirestore();
  const analytics = useAnalytics();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    if (!firestore || !user) return;

    const fetchOrCreateQuiz = async () => {
      setLoading(true);
      try {
        const lessonId = params.quizId;
        // This is not a valid path according to backend.json
        // We need to find the lesson to get topicId and roadmapId. This is inefficient.
        // A better approach would be to have topicId and roadmapId in the URL, but we work with what we have.
        
        // Let's find the lesson by querying all roadmaps. This is very inefficient and not scalable.
        // In a real app, the lesson doc would either have parent IDs or the path would be more specific.
        const topicsSnapshot = await getDocs(collection(firestore, 'topics'));
        let lessonData: any = null;
        let lessonDoc: any = null;
        let topicId: string | null = null;
        let roadmapId: string | null = null;

        for (const topicDoc of topicsSnapshot.docs) {
          const roadmapsSnapshot = await getDocs(collection(firestore, 'topics', topicDoc.id, 'roadmaps'));
          for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonsSnapshot = await getDocs(collection(firestore, 'topics', topicDoc.id, 'roadmaps', roadmapDoc.id, 'lessons'));
            lessonDoc = lessonsSnapshot.docs.find(d => d.id === lessonId);
            if (lessonDoc) {
              lessonData = lessonDoc.data();
              topicId = topicDoc.id;
              roadmapId = roadmapDoc.id;
              break;
            }
          }
          if (lessonDoc) break;
        }

        if (!lessonData || !topicId || !roadmapId) {
            toast({ variant: 'destructive', title: 'Lesson not found' });
            return;
        }

        const testsRef = collection(firestore, 'lessons', lessonId, 'tests');
        const q = query(testsRef, limit(1));
        const existingTestSnapshot = await getDocs(q);

        let quizQuestions;
        let testId;

        if (!existingTestSnapshot.empty) {
          const testDoc = existingTestSnapshot.docs[0];
          testId = testDoc.id;
          const testData = testDoc.data();
          quizQuestions = testData.questions;
        } else {
          toast({ title: 'Generating a new quiz...', description: 'This may take a moment.' });
          
          const quizResult = await generateQuizzesForKnowledgeAssessment({
            lessonId: lessonId,
            topic: "General Knowledge", // Placeholder, ideally from topic data
            stepTitle: "A Step", // Placeholder, ideally from roadmap step data
            lessonTitle: lessonData.title,
            lessonDescription: lessonData.description,
          });
          
          quizQuestions = quizResult.quiz.questions;

          const newTestDocRef = await addDoc(testsRef, {
            lessonId: lessonId,
            questions: quizQuestions,
            createdBy: user.uid,
          });
          testId = newTestDocRef.id;
        }

        const formattedQuizData = {
            id: testId,
            title: lessonData.title,
            questions: quizQuestions.map((q: any, index: number) => ({ ...q, id: `q${index}` })),
            topicId,
            roadmapId,
        };
        setQuizData(formattedQuizData);
        if (analytics) {
            trackQuizStart(analytics, lessonId, topicId);
        }

      } catch (error) {
        console.error("Error fetching or creating quiz:", error);
        toast({ variant: 'destructive', title: 'Failed to load quiz', description: 'Please try again later.' });
      } finally {
        setLoading(false);
      }
    };

    fetchOrCreateQuiz();
  }, [firestore, user, params.quizId, toast, analytics]);

  const score = quizData ? quizData.questions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correctAnswer ? acc + 1 : acc;
  }, 0) : 0;
  const scorePercentage = quizData ? (score / quizData.questions.length) * 100 : 0;
  const passed = scorePercentage >= 80;

  const handleNext = async () => {
    if (currentQuestionIndex < quizData!.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsSubmitting(true);
      try {
        if(analytics && quizData) {
            trackQuizCompletion(analytics, params.quizId, quizData.topicId, score, passed);
        }
        if(passed) {
          await updateProgress();
        }
      } catch (error) {
        console.error("Failed to update progress:", error);
        toast({
          variant: 'destructive',
          title: 'Error updating progress',
          description: 'Could not update your learning status. Please try again.'
        });
      } finally {
        setIsSubmitting(false);
        setShowResult(true);
      }
    }
  };

  const updateProgress = async () => {
    if (!firestore || !user || !quizData) return;

    const batch = writeBatch(firestore);
    const lessonId = params.quizId;
    const { topicId, roadmapId } = quizData;
    
    // 1. Mark current lesson as "Learned"
    const lessonRef = doc(firestore, 'topics', topicId, 'roadmaps', roadmapId, 'lessons', lessonId);
    batch.update(lessonRef, { status: "Learned" });

    // 2. Check if all other lessons in the step are learned
    const lessonsInStepRef = collection(firestore, 'topics', topicId, 'roadmaps', roadmapId, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsInStepRef);
    const allLessons = lessonsSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    const allLearned = allLessons.every(l => l.status === "Learned" || l.id === lessonId);

    if (allLearned) {
        // 3. Mark current step as "Learned"
        const currentStepRef = doc(firestore, 'topics', topicId, 'roadmaps', roadmapId);
        batch.update(currentStepRef, { status: "Learned" });

        // 4. Unlock next step
        const currentStepSnap = await getDoc(currentStepRef);
        const currentStepNumber = currentStepSnap.data()?.stepNumber;

        if (currentStepNumber) {
            const roadmapsInTopicRef = collection(firestore, 'topics', topicId, 'roadmaps');
            const nextStepQuery = query(roadmapsInTopicRef, where("stepNumber", "==", currentStepNumber + 1), limit(1));
            const nextStepSnapshot = await getDocs(nextStepQuery);
            if (!nextStepSnapshot.empty) {
                const nextStepDoc = nextStepSnapshot.docs[0];
                batch.update(nextStepDoc.ref, { status: "Learning" });
            }
        }
    }

    await batch.commit();
    toast({ title: "Progress Saved!", description: "You've unlocked the next part of your journey." });
  };

  const handleOptionChange = (value: string) => {
    setSelectedAnswers({
        ...selectedAnswers,
        [currentQuestion.id]: value
    });
  };

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
  
  return (
    <div className="flex items-center justify-center min-h-full py-12">
      <AnimatePresence mode="wait">
        <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl"
        >
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">Quiz for: {quizData.title}</p>
          <CardTitle className="font-headline">Knowledge Check</CardTitle>
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
          <Button onClick={handleNext} className="w-full md:w-auto ml-auto" disabled={!selectedAnswers[currentQuestion.id] || isSubmitting}>
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {currentQuestionIndex < quizData.questions.length - 1 ? "Next Question" : "Submit Quiz"}
            <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
        </CardFooter>
      </Card>
      </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50"
          >
            <AlertDialog open={showResult} onOpenChange={setShowResult}>
                <AlertDialogContent asChild>
                  <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <AlertDialogHeader className="items-center text-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { delay: 0.2, type: 'spring' } }}>
                            {passed ? <CheckCircle className="h-16 w-16 text-green-500 mb-2"/> : <XCircle className="h-16 w-16 text-destructive mb-2"/>}
                        </motion.div>
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
                               <Link href={`/roadmap/${quizData.topicId}`}>Continue Your Journey</Link>
                            </AlertDialogAction>
                        ) : (
                            <AlertDialogAction onClick={() => { setShowResult(false); setCurrentQuestionIndex(0); setSelectedAnswers({}); }} className="w-full">
                                Retry Quiz
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                  </motion.div>
                </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
