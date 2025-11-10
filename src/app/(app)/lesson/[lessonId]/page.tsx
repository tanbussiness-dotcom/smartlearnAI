
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
} from 'lucide-react';
import { useFirestore, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { vertexDynamicSectionGenerator } from '@/ai/flows/vertexDynamicSectionGenerator.flow';

type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

type OutlineSection = {
  sectionId: string;
  title: string;
  goal: string;
  status: 'not_started' | 'generating' | 'completed';
};

type LessonSection = {
  title: string;
  content: string;
  quiz: QuizQuestion[];
};

type LessonData = {
  id: string;
  title: string;
  overview: string;
  outline: OutlineSection[];
  sections: Record<string, LessonSection>; // Keyed by sectionId
};

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.lessonId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSections, setActiveSections] = useState<string[]>([]);
  const [generatingSections, setGeneratingSections] = useState<string[]>([]);

  const lessonRef = useMemo(() => {
    if (!firestore || !user) return null;
    // This path is just an example, adjust it to your actual Firestore structure
    const path = `users/${user.uid}/lessons/${lessonId}`;
    return doc(firestore, path);
  }, [firestore, user, lessonId]);

  useEffect(() => {
    if (!lessonRef) return;
    
    setLoading(true);
    const unsubscribe = onSnapshot(lessonRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as LessonData;
          setLesson(data);
          // Auto-open the first incomplete section
          const firstIncomplete = data.outline.find(s => s.status !== 'completed');
          if (firstIncomplete && !activeSections.includes(firstIncomplete.sectionId)) {
            setActiveSections(prev => [...prev, firstIncomplete.sectionId]);
          }
        } else {
          toast({ variant: 'destructive', title: 'Lesson not found' });
          setLesson(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching lesson:', error);
        toast({ variant: 'destructive', title: 'Failed to load lesson.' });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [lessonRef, toast, activeSections]);

  const handleGenerateSection = useCallback(
    async (section: OutlineSection) => {
      if (!lesson || !user || !lessonRef) return;

      setGeneratingSections((prev) => [...prev, section.sectionId]);

      try {
        const generatedSection = await vertexDynamicSectionGenerator({
          topic: lesson.title,
          sectionId: section.sectionId,
          sectionTitle: section.title,
          sectionGoal: section.goal,
        });

        const newSections = {
          ...lesson.sections,
          [section.sectionId]: {
            title: generatedSection.title,
            content: generatedSection.content,
            quiz: generatedSection.quiz,
          },
        };

        const newOutline = lesson.outline.map((s) =>
          s.sectionId === section.sectionId ? { ...s, status: 'completed' } : s
        );

        // Non-blocking update to Firestore
        updateDocumentNonBlocking(lessonRef, {
            sections: newSections,
            outline: newOutline,
        });

        toast({
          title: `"${section.title}" is ready!`,
          description: 'The content for the section has been generated.',
        });

      } catch (error: any) {
        console.error('Failed to generate section content:', error);
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: `Could not generate content for "${section.title}". The AI may be busy. Please try again.`,
        });
      } finally {
        setGeneratingSections((prev) =>
          prev.filter((id) => id !== section.sectionId)
        );
      }
    },
    [lesson, user, lessonRef, toast]
  );

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
        <p className="text-muted-foreground">Lesson not found or you do not have access.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="container mx-auto max-w-4xl py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight">
          {lesson.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
          {lesson.overview}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Outline</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion
            type="multiple"
            value={activeSections}
            onValueChange={setActiveSections}
            className="w-full space-y-2"
          >
            {lesson.outline.map((section, index) => {
              const isGenerating = generatingSections.includes(section.sectionId);
              const sectionContent = lesson.sections[section.sectionId];

              return (
                <AccordionItem
                  key={section.sectionId}
                  value={section.sectionId}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4">
                      {section.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <h4 className="font-semibold">{`Part ${index + 1}: ${section.title}`}</h4>
                        <p className="text-sm text-muted-foreground">{section.goal}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 border-t">
                    {sectionContent ? (
                      <article className="prose dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                          {sectionContent.content}
                        </ReactMarkdown>
                        {/* Quiz could be rendered here */}
                      </article>
                    ) : (
                      <div className="text-center py-8 px-4 bg-muted/50 rounded-lg">
                        <Button
                          onClick={() => handleGenerateSection(section)}
                          disabled={isGenerating}
                          size="lg"
                        >
                          {isGenerating ? (
                            <>
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate Section Content
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click to generate the detailed content for this section using AI.
                        </p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <Button size="lg">
          <Check className="mr-2 h-4 w-4" />
          Mark Entire Lesson as Complete
        </Button>
      </div>
    </motion.div>
  );
}
