import Link from "next/link";
import Image from "next/image";
import { SearchIcon, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function SearchPage() {
  const popularTopics = [
    {
      id: "python",
      title: "Python for Beginners",
      description: "Start your journey into programming with the world's most popular language.",
      image: PlaceHolderImages.find((img) => img.id === "topicPython"),
      href: "/roadmap/python-for-beginners",
    },
    {
      id: "guitar",
      title: "Learn Acoustic Guitar",
      description: "From your first chord to your first song, we'll guide you all the way.",
      image: PlaceHolderImages.find((img) => img.id === "topicGuitar"),
      href: "/roadmap/learn-acoustic-guitar",
    },
    {
      id: "marketing",
      title: "Digital Marketing 101",
      description: "Understand the fundamentals of SEO, SEM, and social media marketing.",
      image: PlaceHolderImages.find((img) => img.id === "topicMarketing"),
      href: "/roadmap/digital-marketing-101",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline text-center mb-4">
          What do you want to learn today?
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Our AI will create a personalized roadmap just for you.
        </p>

        <div className="relative mb-12">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="e.g., 'Learn Python from scratch' or 'Basics of cooking'"
            className="w-full pl-12 h-14 text-lg rounded-full shadow-lg"
          />
           <Button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full h-10 w-24" asChild>
            <Link href="/roadmap/custom-topic">Generate</Link>
          </Button>
        </div>

        <h2 className="text-2xl font-bold font-headline mb-6">Or start with a popular topic</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {popularTopics.map((topic) => (
            <Card key={topic.id} className="text-left hover:shadow-xl transition-shadow">
              <CardHeader>
                {topic.image && (
                    <div className="overflow-hidden rounded-lg mb-4">
                        <Image
                        src={topic.image.imageUrl}
                        alt={topic.title}
                        width={400}
                        height={300}
                        data-ai-hint={topic.image.imageHint}
                        className="object-cover aspect-[4/3]"
                        />
                    </div>
                )}
                <CardTitle className="font-headline">{topic.title}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="ghost" asChild className="-ml-4">
                  <Link href={topic.href}>
                    Start Learning <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
