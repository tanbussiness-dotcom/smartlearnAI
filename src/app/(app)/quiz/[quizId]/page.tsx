
"use client";

import { useState, useEffect, useMemo } from "react";
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
import { CheckCircle, XCircle, ArrowRight, LoaderCircle, BookOpen } from "lucide-react";
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, FirestorePermissionError, errorEmitter } from "@/firebase";
import { collection, doc, addDoc, getDocs, query, limit, getDoc, writeBatch, where } from "firebase/firestore";
import { generateQuizForLesson } from "@/ai/flows/generate-quizzes-for-knowledge-assessment";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams, useSearchParams } from "next/navigation";


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
  const searchParams = useSearchParams();
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
  const noQuiz = searchParams.get('noQuiz') === 'true';


  useEffect(() => {
    if (noQuiz || !firestore || !user) {
        setLoading(false);
        return;
    };

    const fetchOrCreateQuiz = async () => {
      setLoading(true);
      try {
        const topicId = searchParams.get('topicId');
        const roadmapId = searchParams.get('roadmapId');

        if (!topicId || !roadmapId) {
             toast({ variant: 'destructive', title: 'Không tìm thấy bài học' });
             router.push('/dashboard');
             return;
        }

        const lessonDocRef = doc(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', roadmapId, 'lessons', lessonId);
        const lessonSnap = await getDoc(lessonDocRef);

        if (!lessonSnap.exists()) {
            toast({ variant: 'destructive', title: 'Không tìm thấy bài học' });
            router.push('/dashboard');
            return;
        }
        
        const lessonData = lessonSnap.data();

        if (lessonData.has_no_quiz) {
            setLoading(false);
            return;
        }

        const testsRef = collection(lessonDocRef, 'tests');
        let testResult;
        let testId;

        if (lessonData.quiz_id && lessonData.quiz_ready) {
            const testDocRef = doc(testsRef, lessonData.quiz_id);
            const existingTestSnapshot = await getDoc(testDocRef);

            if (existingTestSnapshot && existingTestSnapshot.exists()) {
                testId = existingTestSnapshot.id;
                testResult = existingTestSnapshot.data();
            }
        }

        if (!testResult) {
            toast({ title: 'Đang tạo bài kiểm tra mới...', description: 'Việc này có thể mất một lúc.' });
            
            const lessonContent = lessonData.content || "";
            if (!lessonContent) {
                toast({ variant: 'destructive', title: 'Không thể tạo bài kiểm tra', description: 'Nội dung bài học trống.' });
                router.push(`/lesson/${lessonId}?topicId=${topicId}&roadmapId=${roadmapId}`);
                return;
            }

            const quizResultFromAI = await generateQuizForLesson({
                lesson_id: lessonId,
                lesson_content: lessonContent,
            });

            if (!quizResultFromAI.questions || quizResultFromAI.questions.length === 0) {
                 updateDocumentNonBlocking(lessonDocRef, { has_no_quiz: true, quiz_ready: false });
                 setLoading(false);
                 return;
            }
            
            const newTestDocRef = await addDocumentNonBlocking(testsRef, {
                ...quizResultFromAI,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
            });

            testId = newTestDocRef.id;
            testResult = quizResultFromAI;

            updateDocumentNonBlocking(lessonDocRef, {
                quiz_id: testId,
                quiz_ready: true,
                has_no_quiz: false,
            });
        }

        if (testId && testResult) {
            const formattedQuizData: QuizData = {
                id: testId,
                title: lessonData.title,
                questions: testResult.questions.map((q: any, index: number) => ({ ...q, id: `q${index}` })),
                topicId,
                roadmapId,
            };
            setQuizData(formattedQuizData);
        } else {
             updateDocumentNonBlocking(lessonDocRef, { has_no_quiz: true, quiz_ready: false });
        }
        
      } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: 'users/' + user.uid,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Caught in fetchOrCreateQuiz:", serverError);
      } finally {
        setLoading(false);
      }
    };

    fetchOrCreateQuiz();
  }, [firestore, user, lessonId, toast, router, noQuiz, searchParams]);

  const score = quizData ? quizData.questions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correct_answer ? acc + 1 : acc;
  }, 0) : 0;
  const scorePercentage = quizData && quizData.questions.length > 0 ? (score / quizData.questions.length) * 100 : 0;
  const passed = scorePercentage >= 70;

  const handleNext = async () => {
    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsSubmitting(true);
      if (passed) {
        await updateProgress();
      }
      setIsSubmitting(false);
      setShowResult(true);
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

    let nextStepRef: any = null;
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
                nextStepRef = nextStepDoc.ref;
            }
        }
    }

    try {
        await batch.commit();
        toast({ title: "Đã lưu tiến độ!", description: "Bạn đã mở khóa phần tiếp theo của hành trình." });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: nextStepRef ? nextStepRef.path : lessonRef.path,
            operation: 'update',
            requestResourceData: { status: 'Learned' },
        });
        errorEmitter.emit('permission-error', permissionError);
        
        toast({
            variant: 'destructive',
            title: 'Lỗi cập nhật tiến độ',
            description: 'Không thể cập nhật trạng thái học tập của bạn. Vui lòng thử lại.'
        });
        
        throw serverError;
    }
  };

  const handleOptionChange = (value: string) => {
    if (!currentQuestion) return;
    setSelectedAnswers({
        ...selectedAnswers,
        [currentQuestion.id]: value
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Đang tải bài kiểm tra...</p>
      </div>
    );
  }

  if (noQuiz || !quizData || !quizData.questions || quizData.questions.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 text-center">
            <BookOpen className="h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-semibold text-muted-foreground">
              Bài học này không có bài kiểm tra
            </h2>
            <p className="text-gray-500 max-w-sm mt-2">
              Bạn đã hoàn thành bài học, hãy tiếp tục đến lộ trình để học bài tiếp theo nhé!
            </p>
            <Button asChild className="mt-6" onClick={async () => await updateProgress()}>
                <Link href={quizData?.topicId ? `/roadmap/${quizData.topicId}` : '/dashboard'}>Hoàn thành & Quay lại Lộ trình</Link>
            </Button>
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
