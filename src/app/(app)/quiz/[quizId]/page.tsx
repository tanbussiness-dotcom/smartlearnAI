
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
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, addDoc, getDocs, query, limit, getDoc, writeBatch, where } from "firebase/firestore";
import { generateQuizForLesson } from "@/ai/flows/generate-quizzes-for-knowledge-assessment";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";


type QuizQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

type QuizData = {
  id: string;
  topicId: string;
  roadmapId: string;
  title: string;
  questions: (QuizQuestion & { id: string })[];
};

export default function QuizPage() {
  const params = useParams();
  const lessonId = params.quizId as string; // quizId is lessonId
  const firestore = useFirestore();
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
        
        let lessonData: any = null;
        let topicId: string | null = null;
        let roadmapId: string | null = null;
        let lessonDocRef: any = null;

        const topicsSnapshot = await getDocs(collection(firestore, 'users', user.uid, 'topics'));
        for (const topicDoc of topicsSnapshot.docs) {
          const roadmapsSnapshot = await getDocs(collection(firestore, 'users', user.uid, 'topics', topicDoc.id, 'roadmaps'));
          for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonRef = doc(firestore, 'users', user.uid, 'topics', topicDoc.id, 'roadmaps', roadmapDoc.id, 'lessons', lessonId);
            const lessonSnap = await getDoc(lessonRef);
            if (lessonSnap.exists()) {
              lessonData = lessonSnap.data();
              topicId = topicDoc.id;
              roadmapId = roadmapDoc.id;
              lessonDocRef = lessonRef;
              break;
            }
          }
          if (lessonData) break;
        }

        if (!lessonData || !topicId || !roadmapId || !lessonDocRef) {
            toast({ variant: 'destructive', title: 'Lesson not found' });
            router.push('/dashboard');
            return;
        }

        const testsRef = collection(lessonDocRef, 'tests');
        const q = query(testsRef, limit(1));
        const existingTestSnapshot = await getDocs(q);

        let testResult;
        let testId;

        if (!existingTestSnapshot.empty) {
          const testDoc = existingTestSnapshot.docs[0];
          testId = testDoc.id;
          testResult = testDoc.data();
        } else {
          toast({ title: 'Generating a new quiz...', description: 'This may take a moment.' });
          
          const lessonContent = lessonData.content || lessonData.synthesized_content || lessonData.instructions || "";
          if (!lessonContent) {
            toast({ variant: 'destructive', title: 'Cannot generate quiz', description: 'Lesson content is empty.' });
            router.push(`/lesson/${lessonId}`);
            return;
          }

          const quizResult = await generateQuizForLesson({
            lesson_id: lessonId,
            lesson_content: lessonContent,
          });
          
          const newTestDocRef = await addDoc(testsRef, {
            ...quizResult,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
          });

          testId = newTestDocRef.id;
          testResult = quizResult;
        }

        const formattedQuizData: QuizData = {
            id: testId,
            title: lessonData.title,
            questions: testResult.questions.map((q: any, index: number) => ({ ...q, id: `q${index}` })),
            topicId,
            roadmapId,
        };
        setQuizData(formattedQuizData);
        

      } catch (error) {
        console.error("Error fetching or creating quiz:", error);
        toast({ variant: 'destructive', title: 'Failed to load quiz', description: 'Please try again later.' });
      } finally {
        setLoading(false);
      }
    };

    fetchOrCreateQuiz();
  }, [firestore, user, lessonId, toast, router]);

  const score = quizData ? quizData.questions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correct_answer ? acc + 1 : acc;
  }, 0) : 0;
  const scorePercentage = quizData ? (score / quizData.questions.length) * 100 : 0;
  const passed = scorePercentage >= 70;

  const handleNext = async () => {
    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsSubmitting(true);
      try {
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
    const { topicId, roadmapId } = quizData;
    
    // 1. Mark current lesson as "Learned"
    const lessonRef = doc(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', roadmapId, 'lessons', lessonId);
    batch.update(lessonRef, { status: "Learned" });

    // 2. Check if all other lessons in the step are learned
    const lessonsInStepRef = collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', roadmapId, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsInStepRef);
    const allLessons = lessonsSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    const allLearned = allLessons.every(l => l.status === "Learned" || l.id === lessonId);

    if (allLearned) {
        // 3. Mark current step as "Learned"
        const currentStepRef = doc(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', roadmapId);
        batch.update(currentStepRef, { status: "Learned" });

        // 4. Unlock next step and set to "Learning"
        const currentStepSnap = await getDoc(currentStepRef);
        const currentStepNumber = currentStepSnap.data()?.stepNumber;

        if (currentStepNumber) {
            const roadmapsInTopicRef = collection(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps');
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
    if (!currentQuestion) return;
    setSelectedAnswers({
        ...selectedAnswers,
        [currentQuestion.id]: value
    });
  };

  if (loading || !quizData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang tải bài kiểm tra...</p>
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
          <p className="text-sm text-muted-foreground">Kiểm tra bài: {quizData.title}</p>
          <CardTitle className="font-headline">Kiểm tra kiến thức</CardTitle>
          <CardDescription>Hoàn thành bài kiểm tra để mở khóa bước tiếp theo.</CardDescription>
          <div className="pt-4">
            <div className="flex justify-between mb-1">
                <span className="text-sm">Câu {currentQuestionIndex + 1} / {quizData.questions.length}</span>
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
            {currentQuestionIndex < quizData.questions.length - 1 ? "Câu tiếp theo" : "Nộp bài"}
            <ArrowRight className="ml-2 h-4 w-4"/>
          </Button>
        </CardFooter>
      </Card>
      </motion.div>
      </AnimatePresence>

      <AnimatePresence>
          {showResult && (
              <AlertDialog open={showResult} onOpenChange={setShowResult}>
                  <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                      <AlertDialogContent>
                          <AlertDialogHeader className="items-center text-center">
                              <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, transition: { delay: 0.2, type: 'spring' } }}
                              >
                                  {passed ? (
                                      <CheckCircle className="h-16 w-16 text-green-500 mb-2" />
                                  ) : (
                                      <XCircle className="h-16 w-16 text-destructive mb-2" />
                                  )}
                              </motion.div>
                              <AlertDialogTitle className="text-2xl font-headline">
                                  {passed ? 'Chúc mừng! Bạn đã vượt qua!' : 'Cố gắng hơn nhé!'}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-base">
                                  Bạn đạt {score} trên {quizData.questions.length} câu (
                                  {scorePercentage.toFixed(0)}%).
                                  <br />
                                  {passed
                                      ? "Bạn đã mở khóa bài học tiếp theo."
                                      : 'Bạn cần đạt 70% để vượt qua. Vui lòng thử lại.'}
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              {passed ? (
                                  <AlertDialogAction asChild className="w-full">
                                      <Link href={`/roadmap/${quizData.topicId}`}>
                                          Tiếp tục hành trình
                                      </Link>
                                  </AlertDialogAction>
                              ) : (
                                  <AlertDialogAction
                                      onClick={() => {
                                          setShowResult(false);
                                          setCurrentQuestionIndex(0);
                                          setSelectedAnswers({});
                                      }}
                                      className="w-full"
                                  >
                                      Làm lại bài kiểm tra
                                  </AlertDialogAction>
                              )}
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </motion.div>
              </AlertDialog>
          )}
      </AnimatePresence>
    </div>
  );
}
