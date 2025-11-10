'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function PopularTopics() {
    const popularTopics = [
        {
          id: 'python',
          title: 'Python for Beginners',
          description:
            "Start your journey into programming with the world's most popular language.",
          image: PlaceHolderImages.find((img) => img.id === 'topicPython'),
          href: '/search?topic=Python for Beginners',
        },
        {
          id: 'guitar',
          title: 'Learn Acoustic Guitar',
          description:
            "From your first chord to your first song, we'll guide you all the way.",
          image: PlaceHolderImages.find((img) => img.id === 'topicGuitar'),
          href: '/search?topic=Learn Acoustic Guitar',
        },
        {
          id: 'marketing',
          title: 'Digital Marketing 101',
          description:
            'Understand the fundamentals of SEO, SEM, and social media marketing.',
          image: PlaceHolderImages.find((img) => img.id === 'topicMarketing'),
          href: '/search?topic=Digital Marketing 101',
        },
      ];

    return (
        <div>
            <h2 className="text-2xl font-bold font-headline mb-6">
                Hoặc bắt đầu với một chủ đề phổ biến
            </h2>
            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                initial="hidden"
                animate="visible"
                variants={{
                    visible: { transition: { staggerChildren: 0.1 } },
                    hidden: {},
                }}
            >
                {popularTopics.map((t) => (
                <motion.div
                    key={t.id}
                    variants={{
                        hidden: { y: 20, opacity: 0 },
                        visible: { y: 0, opacity: 1 },
                    }}
                >
                    <Card className="text-left hover:shadow-xl transition-shadow h-full flex flex-col">
                    <CardHeader>
                        {t.image && (
                        <div className="overflow-hidden rounded-lg mb-4">
                            <Image
                            src={t.image.imageUrl}
                            alt={t.title}
                            width={400}
                            height={300}
                            data-ai-hint={t.image.imageHint}
                            className="object-cover aspect-[4/3]"
                            />
                        </div>
                        )}
                        <CardTitle className="font-headline">{t.title}</CardTitle>
                        <CardDescription>{t.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="mt-auto">
                        <Button variant="ghost" asChild className="-ml-4">
                        <Link href={t.href}>
                            Bắt đầu học <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                        </Button>
                    </CardFooter>
                    </Card>
                </motion.div>
                ))}
            </motion.div>
        </div>
    )
}
