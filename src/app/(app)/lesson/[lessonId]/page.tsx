
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardList,
  CardListItem,
  CardTitle,
} from '@/components/ui/card';
import {
  Check,
  ArrowRight,
  ChevronRight,
  LoaderCircle,
  Clock,
  BookOpen,
  Link as LinkIcon,
  Bot,
  Youtube,
  Star,
  Film,
  Library,
  List,
} from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  getDoc,
  query,
  where,
  limit,
  orderBy,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import React from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { format } from 'date-fns';

const ResponsiveYoutubeEmbed = React.lazy(
  () => import('@/components/youtube-embed')
);

type Source = {
  title: string;
  url: string;
  domain: string;
  type: 'article' | 'doc' | 'video' | 'tutorial';
  short_note: string;
  relevance?: number;
};

type Video = {
  title: string;
  url: string;
  channel: string;
};

type TocEntry = {
  level: number;
  id: string;
  title: string;
};

type LessonInfo = {
  title: string;
  overview: string;
  content: string;
  sources: Source[];
  videos: Video[];
  estimated_time_min: number;
  userId: string;
  topicId: string;
  roadmapId: string;
  createdAt: string; // ISO date string
  isAiGenerated: boolean;
  has_quiz: boolean;
  quiz_ready: boolean;
};

const getYoutubeEmbedId = (url: string): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (
      urlObj.hostname === 'www.youtube.com' ||
      urlObj.hostname === 'youtube.com'
    ) {
      return urlObj.searchParams.get('v');
    }
  } catch (e) {
    console.error('Invalid YouTube URL:', url);
  }
  return null;
};

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
};

const HeadingRenderer = ({ level, children }: { level: any; children: any }) => {
    const text = React.Children.toArray(children).join('');
    const slug = generateSlug(text);
    return React.createElement(`h${level}`, { id: slug }, children);
};


export default function LessonPage() {
  const params = useParams();
  const lessonId = params.lessonId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [nextLesson, setNextLesson] = useState<{
    id: string;
    title: string;
    stepTitle: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string>('');

  const tableOfContents = useMemo(() => {
    if (!lesson?.content) return [];
    const headings: TocEntry[] = [];
    const matches = lesson.content.matchAll(/^(##|###) (.*)/gm);
    for (const match of matches) {
      const level = match[1].length;
      const title = match[2];
      headings.push({
        level,
        title,
        id: generateSlug(title),
      });
    }
    return headings;
  }, [lesson?.content]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );
  
    const headings = document.querySelectorAll('.prose h2, .prose h3');
    headings.forEach((heading) => observer.observe(heading));
  
    return () => observer.disconnect();
  }, [lesson]);


  useEffect(() => {
    if (!firestore || !user || !lessonId) return;

    const fetchLessonDetails = async () => {
      setLoading(true);
      try {
        const topicsSnapshot = await getDocs(
          collection(firestore, 'users', user.uid, 'topics')
        );
        let found = false;

        for (const topicDoc of topicsSnapshot.docs) {
          const roadmapsSnapshot = await getDocs(
            collection(
              firestore,
              'users',
              user.uid,
              'topics',
              topicDoc.id,
              'roadmaps'
            )
          );
          for (const roadmapDoc of roadmapsSnapshot.docs) {
            const lessonRef = doc(
              firestore,
              'users',
              user.uid,
              'topics',
              topicDoc.id,
              'roadmaps',
              roadmapDoc.id,
              'lessons',
              lessonId
            );
            const lessonSnap = await getDoc(lessonRef);

            if (lessonSnap.exists()) {
              const lessonData = lessonSnap.data();
              // Adapt to new structure, with fallbacks for old structure
              const fetchedLesson: LessonInfo = {
                title: lessonData.title,
                overview:
                  lessonData.overview ||
                  lessonData.summary ||
                  lessonData.description,
                content:
                  lessonData.content ||
                  lessonData.synthesized_content ||
                  lessonData.instructions ||
                  'Nội dung bài học chưa được cập nhật.',
                sources: lessonData.sources || [],
                videos: lessonData.videos || [],
                estimated_time_min: lessonData.estimated_time_min || 15,
                userId: user.uid,
                topicId: topicDoc.id,
                roadmapId: roadmapDoc.id,
                createdAt: lessonData.createdAt
                  ? lessonData.createdAt.toDate
                    ? lessonData.createdAt.toDate().toISOString()
                    : lessonData.createdAt
                  : new Date().toISOString(),
                isAiGenerated: !!(
                  lessonData.content || lessonData.synthesized_content
                ),
                has_quiz: lessonData.has_quiz || false,
                quiz_ready: lessonData.quiz_ready || false,
              };

              // Compatibility: If old video_links exists, convert to new video structure
              if (
                lessonData.video_links &&
                lessonData.video_links.length > 0 &&
                fetchedLesson.videos.length === 0
              ) {
                fetchedLesson.videos = lessonData.video_links.map(
                  (link: string) => ({
                    title: 'Video tham khảo',
                    url: link,
                    channel: 'YouTube',
                  })
                );
              }
              // Compatibility: for even older youtubeLink
              if (lessonData.youtubeLink && fetchedLesson.videos.length === 0) {
                fetchedLesson.videos.push({
                  title: 'Video tham khảo',
                  url: lessonData.youtubeLink,
                  channel: 'YouTube',
                });
              }

              setLesson(fetchedLesson);

              // Find next lesson logic...
              const lessonsInStepQuery = query(
                collection(
                  firestore,
                  'users',
                  user.uid,
                  'topics',
                  topicDoc.id,
                  'roadmaps',
                  roadmapDoc.id,
                  'lessons'
                ),
                orderBy('title') // Assuming lessons can be ordered by title or another field
              );
              const lessonsInStepSnapshot = await getDocs(lessonsInStepQuery);
              const allLessonsInStep = lessonsInStepSnapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));
              const currentIndex = allLessonsInStep.findIndex(
                (l) => l.id === lessonId
              );

              if (
                currentIndex !== -1 &&
                currentIndex < allLessonsInStep.length - 1
              ) {
                const nextLessonData = allLessonsInStep[currentIndex + 1];
                const stepSnap = await getDoc(roadmapDoc.ref);
                setNextLesson({
                  id: nextLessonData.id,
                  title: nextLessonData.title,
                  stepTitle: stepSnap.data()?.stepTitle || 'Next Step',
                });
              } else {
                const currentStepSnap = await getDoc(roadmapDoc.ref);
                const currentStepNumber = currentStepSnap.data()?.stepNumber;

                if (currentStepNumber) {
                  const roadmapsInTopicRef = collection(
                    firestore,
                    'users',
                    user.uid,
                    'topics',
                    topicDoc.id,
                    'roadmaps'
                  );
                  const nextStepQuery = query(
                    roadmapsInTopicRef,
                    where('stepNumber', '==', currentStepNumber + 1),
                    limit(1)
                  );
                  const nextStepSnapshot = await getDocs(nextStepQuery);

                  if (!nextStepSnapshot.empty) {
                    const nextStepDoc = nextStepSnapshot.docs[0];
                    const nextStepLessonsQuery = query(
                      collection(nextStepDoc.ref, 'lessons'),
                      orderBy('title'),
                      limit(1)
                    );
                    const nextStepLessonsSnapshot = await getDocs(
                      nextStepLessonsQuery
                    );
                    if (!nextStepLessonsSnapshot.empty) {
                      const firstLessonOfNextStep =
                        nextStepLessonsSnapshot.docs[0];
                      setNextLesson({
                        id: firstLessonOfNextStep.id,
                        title: firstLessonOfNextStep.data().title,
                        stepTitle: nextStepDoc.data().stepTitle,
                      });
                    }
                  }
                }
              }

              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          toast({ variant: 'destructive', title: 'Lesson not found.' });
        }
      } catch (error) {
        console.error('Error fetching lesson:', error);
        toast({ variant: 'destructive', title: 'Failed to load lesson.' });
      } finally {
        setLoading(false);
      }
    };

    fetchLessonDetails();
  }, [firestore, user, lessonId, toast]);

  const handleMarkAsComplete = async () => {
    if (!firestore || !lesson) return;
    setIsCompleting(true);
    try {
      const lessonRef = doc(
        firestore,
        'users',
        lesson.userId,
        'topics',
        lesson.topicId,
        'roadmaps',
        lesson.roadmapId,
        'lessons',
        lessonId
      );
      await updateDoc(lessonRef, {
        status: 'Learned',
      });
      toast({
        title: 'Lesson Completed!',
        description: 'Great job! Your progress has been updated.',
      });
    } catch (error) {
      console.error('Error updating lesson status:', error);
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not update your progress. Please try again.',
      });
    } finally {
      setIsCompleting(false);
    }
  };

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
        <p className="text-muted-foreground">Lesson not found.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="container mx-auto max-w-7xl py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight">
          {lesson.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">{lesson.overview}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{lesson.estimated_time_min} phút đọc</span>
          </div>
          {lesson.isAiGenerated && (
            <Badge variant="secondary" className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span>AI Generated</span>
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <span>
              Tạo ngày {format(new Date(lesson.createdAt), 'dd/MM/yyyy')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <BookOpen className="h-5 w-5" />
                Nội dung bài học
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lesson.content && lesson.content.length < 400 ? (
                <div className="text-center py-8">
                  <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Bài học này đang được AI mở rộng nội dung chi tiết. Vui lòng quay lại sau.</p>
                </div>
              ) : (
                <ReactMarkdown
                    className="prose dark:prose-invert max-w-none"
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        h2: ({node, ...props}) => <HeadingRenderer level={2} {...props} />,
                        h3: ({node, ...props}) => <HeadingRenderer level={3} {...props} />,
                    }}
                >
                    {lesson.content}
                </ReactMarkdown>
              )}
            </CardContent>
          </Card>

          {lesson.videos && lesson.videos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                  <Film className="h-5 w-5" />
                  Videos tham khảo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lesson.videos.map((video, index) => {
                  const videoId = getYoutubeEmbedId(video.url);
                  if (!videoId) return null;
                  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                  return (
                    <a
                      key={index}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group space-y-2"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-lg">
                        <Image
                          src={thumbnailUrl}
                          alt={video.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          style={{objectFit: 'cover'}}
                          className="transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Youtube className="h-10 w-10 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-sm leading-tight group-hover:text-primary">
                          {video.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {video.channel}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {lesson.sources && lesson.sources.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-lg">
                  <Library className="h-5 w-5" />
                  Nguồn & Đọc thêm
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lesson.sources.map((source, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-md bg-muted/50"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {source.title}
                    </a>
                    <p className="text-sm text-muted-foreground mt-1 italic">
                      "{source.short_note}"
                    </p>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />
                        {source.domain}
                      </span>
                      {source.relevance && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Tin cậy: {(source.relevance * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-lg">
                  <Library className="h-5 w-5" />
                  Nguồn & Đọc thêm
                </CardTitle>
              </CardHeader>
              <CardContent>
                 <p className="text-sm text-muted-foreground">Chưa có nguồn tham khảo cho bài học này.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Hoàn thành bài học</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Khi đã nắm vững kiến thức, hãy đánh dấu bài học này là đã hoàn
                thành.
              </p>
              <Button
                className="w-full"
                onClick={handleMarkAsComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Đánh dấu đã hoàn thành
              </Button>
            </CardContent>
          </Card>

          {lesson.has_quiz && (
            <Card className="bg-primary/10 border-primary">
              <CardHeader>
                <CardTitle className="font-headline">Làm bài kiểm tra</CardTitle>
                <CardDescription>
                  Kiểm tra kiến thức của bạn để mở khóa bài học tiếp theo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  asChild
                  disabled={!lesson.quiz_ready}
                >
                  <Link href={`/quiz/${lessonId}`}>
                    {!lesson.quiz_ready && (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {lesson.quiz_ready
                      ? 'Bắt đầu kiểm tra'
                      : 'Quiz đang được tạo...'}
                    {lesson.quiz_ready && (
                      <ArrowRight className="ml-2 h-4 w-4" />
                    )}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {tableOfContents.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline text-lg">
                        <List className="h-5 w-5"/>
                        Mục lục
                    </CardTitle>
                </CardHeader>
                <CardList>
                    {tableOfContents.map((item) => (
                        <CardListItem key={item.id} className={item.level === 3 ? "pl-4" : ""}>
                            <a
                                href={`#${item.id}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className={`block text-sm hover:text-primary transition-colors ${activeTocId === item.id ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                            >
                                {item.title}
                            </a>
                        </CardListItem>
                    ))}
                </CardList>
            </Card>
          )}

          {nextLesson && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  Bài học tiếp theo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/lesson/${nextLesson.id}`} className="group">
                  <div className="flex justify-between items-center p-3 hover:bg-muted rounded-md transition-colors">
                    <div>
                      <p className="font-medium">{nextLesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {nextLesson.stepTitle}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}

    