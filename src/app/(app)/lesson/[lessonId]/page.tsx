import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Check, ArrowRight, FileText, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ResponsiveYoutubeEmbed = ({ embedId }: { embedId: string }) => (
  <div className="relative overflow-hidden w-full" style={{ paddingTop: "56.25%" }}>
    <iframe
      className="absolute top-0 left-0 bottom-0 right-0 w-full h-full"
      src={`https://www.youtube.com/embed/${embedId}`}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="Embedded youtube"
    />
  </div>
);

export default function LessonPage({ params }: { params: { lessonId: string } }) {
  const lessonVideoThumb = PlaceHolderImages.find(
    (img) => img.id === "lessonVideoThumb"
  );
  
  const lesson = {
      title: "Variables and Data Types",
      description: "Understand the fundamental building blocks of Python: variables and the different data types you can assign to them.",
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
        <div className="mb-6">
            <h1 className="text-4xl font-extrabold font-headline tracking-tight">{lesson.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{lesson.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card className="overflow-hidden">
                    <ResponsiveYoutubeEmbed embedId="Z1Yd7upQsXY" />
                </Card>

                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <FileText className="h-5 w-5" />
                            Lesson Instructions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm md:prose-base max-w-none dark:prose-invert">
                        <p>
                            In this lesson, we will cover the core concepts of variables and data types in Python. Follow along with the video and the instructions below.
                        </p>
                        <ol>
                            <li><strong>What are Variables?</strong> Understand that variables are containers for storing data values.</li>
                            <li><strong>Creating Variables:</strong> Practice creating variables by assigning values. For example: <code>x = 5</code>, <code>name = "John"</code>.</li>
                            <li><strong>Data Types:</strong> Learn about Python's built-in data types, including:
                                <ul>
                                    <li><strong>Text Type:</strong> <code>str</code></li>
                                    <li><strong>Numeric Types:</strong> <code>int</code>, <code>float</code>, <code>complex</code></li>
                                    <li><strong>Sequence Types:</strong> <code>list</code>, <code>tuple</code>, <code>range</code></li>
                                    <li><strong>Boolean Type:</strong> <code>bool</code></li>
                                </ul>
                            </li>
                            <li><strong>Getting the Data Type:</strong> Use the <code>type()</code> function to check the data type of a variable.</li>
                            <li><strong>Type Casting:</strong> Learn how to convert variables from one data type to another.</li>
                        </ol>
                        <p>
                            Experiment with creating different variables and checking their types in your own Python environment. This hands-on practice is crucial for understanding.
                        </p>
                    </CardContent>
                </Card>
            </div>
            
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Complete Lesson</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">Once you've watched the video and practiced the concepts, mark this lesson as complete.</p>
                        <Button className="w-full">
                            <Check className="mr-2 h-4 w-4"/>
                            Mark as Completed
                        </Button>
                    </CardContent>
                </Card>
                
                <Card className="bg-primary/10 border-primary">
                    <CardHeader>
                        <CardTitle className="font-headline">Take the Quiz</CardTitle>
                        <CardDescription>
                            Pass the quiz to test your knowledge and unlock the next lesson.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full" asChild>
                            <Link href={`/quiz/${params.lessonId}`}>
                                Start Quiz
                                <ArrowRight className="ml-2 h-4 w-4"/>
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-lg">Next Lesson</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/lesson/next-lesson-id" className="group">
                            <div className="flex justify-between items-center p-3 hover:bg-muted rounded-md transition-colors">
                                <div>
                                    <p className="font-medium">If-Else Statements</p>
                                    <p className="text-sm text-muted-foreground">Control Flow</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
