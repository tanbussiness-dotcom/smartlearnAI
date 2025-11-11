
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Check,
  ChevronDown,
  LoaderCircle,
  FileText,
  Circle,
  CheckCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { doc, onSnapshot, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { generateLesson } from '@/ai/flows/lesson/generate-lesson';

type LessonData = {
  id: string;
  title: string;
  overview: string;
  content: string;
  isAiGenerated: boolean;
  quiz_id?: string;
  quiz_ready?: boolean;
  status: 'To Learn' | 'Learning' | 'Learned';
  topic: string;
  phase: string;
};

export default function LessonPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const lessonId = params.lessonId as string;
  
  const topicId = searchParams.get('topicId');
  const roadmapId = searchParams.get('roadmapId');

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const lessonRef = useMemo(() => {
    if (!firestore || !user || !topicId || !roadmapId || !lessonId) return null;
    return doc(firestore, 'users', user.uid, 'topics', topicId, 'roadmaps', roadmapId, 'lessons', lessonId);
  }, [firestore, user, topicId, roadmapId, lessonId]);

  useEffect(() => {
    if (!lessonRef) {
      if (user && (!topicId || !roadmapId)) {
        toast({
          variant: 'destructive',
          title: 'Thiếu thông tin',
          description: 'Không tìm thấy thông tin về chủ đề hoặc lộ trình cho bài học này.'
        });
        setLoading(false);
      }
      return;
    };

    setLoading(true);
    const unsubscribe = onSnapshot(lessonRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as LessonData;
          setLesson({ ...data, id: docSnap.id });
        } else {
          toast({ variant: 'destructive', title: 'Không tìm thấy bài học' });
          setLesson(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Lỗi khi tải bài học:', error);
        toast({ variant: 'destructive', title: 'Không thể tải bài học.' });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [lessonRef, toast, user, topicId, roadmapId]);
  
  const handleGoToQuiz = () => {
    if(lesson?.quiz_id && topicId && roadmapId) {
        router.push(`/quiz/${lesson.id}?topicId=${topicId}&roadmapId=${roadmapId}`);
    } else {
        toast({ title: 'Bài kiểm tra chưa sẵn sàng', description: 'Nội dung kiểm tra vẫn đang được tạo hoặc thiếu thông tin.'})
    }
  }

  const handleGenerateContent = useCallback(async () => {
    if (!lesson || !user || !lessonRef || !firestore) {
       toast({
        variant: 'destructive',
        title: 'Yêu cầu không hợp lệ',
        description: 'Không đủ thông tin để tạo nội dung bài học.',
      });
      return;
    }

    setIsGenerating(true);
    toast({
        title: 'Bắt đầu tạo nội dung bài học...',
        description: 'AI đang làm việc, việc này có thể mất một vài phút.'
    })

    try {
        const response = await generateLesson({
            topic: lesson.topic, 
            phase: lesson.phase,
            lessonId: lesson.id,
        });

        if (!response || response.success === false) {
            const err = response?.error || { step: 'Unknown', message: 'Unknown error' };
            console.error('Lesson generation details:', err);
            toast({
                variant: 'destructive',
                title: `Tạo bài học thất bại ở bước: ${err.step}`,
                description: err.message,
            });
            setIsGenerating(false);
            return;
        }

        const { lesson: lessonData, quiz: quizData } = response.data;
        const batch = writeBatch(firestore);
        
        const lessonPayload = {
            ...lessonData,
            status: 'Learning',
            isAiGenerated: true,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
            quiz_ready: true, 
        };
        batch.update(lessonRef, lessonPayload);

        const quizRef = doc(collection(lessonRef, 'tests'));
        const quizPayload = {
            ...quizData,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        };
        batch.set(quizRef, quizPayload);

        batch.update(lessonRef, { quiz_id: quizRef.id });

        await batch.commit();

        toast({
          title: `"${lesson.title}" đã sẵn sàng!`,
          description: 'Nội dung bài học và bài kiểm tra đã được tạo thành công.',
        });

    } catch (error: any) {
      console.error('generateLesson unexpected exception', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi không mong muốn',
        description: `Đã xảy ra lỗi khi tạo bài học. Vui lòng kiểm tra console để biết thêm chi tiết.`,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [lesson, user, lessonRef, firestore, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full py-12">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex items-center justify-center min-h-full py-12">
        <p className="text-muted-foreground">Không tìm thấy bài học hoặc bạn không có quyền truy cập.</p>
      </div>
    );
  }

  const hasContent = lesson.isAiGenerated && lesson.content;

  return (
    <motion.div
      className="container mx-auto max-w-4xl py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-8 border-b pb-8">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight lg:text-5xl">
          {lesson.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
          {lesson.overview}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-4 lg:gap-12">
        <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
                {hasContent ? (
                    <motion.article 
                        key="content"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="prose prose-lg dark:prose-invert max-w-none"
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {lesson.content}
                        </ReactMarkdown>
                    </motion.article>
                ) : (
                    <motion.div 
                        key="generate"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 px-6 bg-muted/50 rounded-lg border-2 border-dashed"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                            <Sparkles className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Bài học này chưa có nội dung</h3>
                        <p className="text-muted-foreground mb-6">
                            Nhấn nút bên dưới để AI tạo nội dung chi tiết cho bài học này.
                        </p>
                        <Button
                            onClick={handleGenerateContent}
                            disabled={isGenerating}
                            size="lg"
                        >
                            {isGenerating ? (
                            <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Đang tạo...
                            </>
                            ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Tạo nội dung bài học bằng AI
                            </>
                            )}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
                <Card>
                    <CardHeader>
                        <CardTitle>Hành động</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button size="lg" onClick={handleGoToQuiz} disabled={!lesson.quiz_ready || !hasContent}>
                        {!lesson.quiz_ready ? (
                            <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Chuẩn bị...
                            </>
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Làm bài kiểm tra
                            </>
                        )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">Vượt qua bài kiểm tra để hoàn thành.</p>
                    </CardContent>
                </Card>
            </div>
        </aside>
      </div>

      <AnimatePresence>
      {hasContent && (
        <motion.div 
            className="mt-12 text-center lg:hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
        >
          <Button size="lg" onClick={handleGoToQuiz} disabled={!lesson.quiz_ready}>
            {!lesson.quiz_ready ? (
                 <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Đang chuẩn bị kiểm tra...
                 </>
            ) : (
                <>
                    <Check className="mr-2 h-4 w-4" />
                    Làm bài kiểm tra
                </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Vượt qua bài kiểm tra để đánh dấu bài học đã hoàn thành.</p>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
