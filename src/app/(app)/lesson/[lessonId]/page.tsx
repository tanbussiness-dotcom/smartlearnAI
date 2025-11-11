
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
    if (!lesson || !user || !lessonRef || !firestore || !topicId || !roadmapId) {
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
        const result = await generateLesson({
            userId: user.uid,
            topicId: topicId,
            lessonId: lesson.id,
            topic: lesson.topic, 
            phase: lesson.phase,
        });

        const batch = writeBatch(firestore);

        // 1. Update Lesson with content
        const lessonPayload = {
            ...result.lesson,
            status: 'Learning',
            isAiGenerated: true,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
            quiz_ready: true, // Mark quiz as ready now
        };
        batch.update(lessonRef, lessonPayload);

        // 2. Create the Quiz document
        const quizRef = doc(collection(lessonRef, 'tests'));
        const quizPayload = {
            ...result.quiz,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        };
        batch.set(quizRef, quizPayload);

        // 3. Update the lesson again with the quiz ID
        batch.update(lessonRef, { quiz_id: quizRef.id });

        // Commit all writes at once
        await batch.commit();

        toast({
          title: `"${lesson.title}" đã sẵn sàng!`,
          description: 'Nội dung bài học và bài kiểm tra đã được tạo thành công.',
        });

    } catch (error: any) {
      console.error('Lỗi khi tạo và lưu nội dung bài học:', error);
      toast({
        variant: 'destructive',
        title: 'Tạo nội dung thất bại',
        description: `Không thể tạo nội dung cho "${lesson.title}". Lỗi: ${error.message}`,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [lesson, user, lessonRef, firestore, toast, topicId, roadmapId]);

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
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight">
          {lesson.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground max-w-2xl">
          {lesson.overview}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-6 w-6"/>
            Nội dung bài học
          </CardTitle>
        </CardHeader>
        <CardContent>
            <AnimatePresence mode="wait">
                {hasContent ? (
                    <motion.article 
                        key="content"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="prose dark:prose-invert max-w-none"
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
                        className="text-center py-8 px-4 bg-muted/50 rounded-lg"
                    >
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
                        <p className="text-xs text-muted-foreground mt-2">
                            Nhấn để AI tạo nội dung chi tiết cho bài học này.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </CardContent>
      </Card>

      <AnimatePresence>
      {hasContent && (
        <motion.div 
            className="mt-8 text-center"
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
