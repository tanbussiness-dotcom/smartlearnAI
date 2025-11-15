
"use client"
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookCopy, CheckCircle, Target, LoaderCircle } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { format, subDays, startOfDay, differenceInCalendarDays } from 'date-fns';

const chartConfig = {
  tasks: {
    label: "Tasks",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

export default function Dashboard() {
    const { user } = useUser();
    const firestore = useFirestore();

    // Query for all topics
    const topicsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/topics`));
    }, [user, firestore]);
    const { data: topics, isLoading: isLoadingTopics } = useCollection(topicsQuery);

    // Query for daily tasks for the chart
    const dailyTasksQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
        return query(
            collection(firestore, `users/${user.uid}/dailyTasks`),
            where('date', '>=', format(sevenDaysAgo, 'yyyy-MM-dd')),
            orderBy('date', 'asc')
        );
    }, [user, firestore]);
    const { data: dailyTasks, isLoading: isLoadingTasks } = useCollection(dailyTasksQuery);
    
    const stats = useMemo(() => {
        if (!topics) {
            return {
                topicsInProgress: 0,
                completedLessons: 0,
                testsPassed: 0,
                learningStreak: 0,
            };
        }

        const topicsInProgress = topics.filter(t => (t.progress ?? 0) < 100).length;
        const completedLessons = topics.reduce((acc, t) => acc + (t.completedLessons || 0), 0);

        // Calculate streak from dailyTasks
        const completedDates = (dailyTasks || [])
            .filter(task => task.status === 'Completed' && task.date)
            .map(task => startOfDay(new Date(task.date)))
            .sort((a, b) => b.getTime() - a.getTime());

        const uniqueDates = [...new Set(completedDates.map(d => d.getTime()))].map(t => new Date(t));

        let streak = 0;
        if (uniqueDates.length > 0) {
            const today = startOfDay(new Date());
            // Check if latest activity is today or yesterday
            if (differenceInCalendarDays(today, uniqueDates[0]) <= 1) {
                streak = 1;
                for (let i = 1; i < uniqueDates.length; i++) {
                    const diff = differenceInCalendarDays(uniqueDates[i - 1], uniqueDates[i]);
                    if (diff === 1) {
                        streak++;
                    } else if (diff > 1) {
                        break; // Streak is broken
                    }
                }
            }
        }

        return {
            topicsInProgress,
            completedLessons,
            testsPassed: 0, // Placeholder
            learningStreak: streak,
        };
    }, [topics, dailyTasks]);

    const continueLearning = useMemo(() => {
        return (topics || []).filter(t => (t.progress ?? 0) < 100);
    }, [topics]);

    const chartData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), 6 - i);
            return {
                date: format(date, 'yyyy-MM-dd'),
                day: format(date, 'EEE'),
                tasks: 0,
            };
        });

        if (dailyTasks) {
            dailyTasks.forEach(task => {
                // Ensure date is treated as local timezone
                const taskDate = new Date(task.date + 'T00:00:00');
                const taskDateStr = format(taskDate, 'yyyy-MM-dd');
                const dayEntry = last7Days.find(d => d.date === taskDateStr);
                if (dayEntry) {
                    dayEntry.tasks += 1;
                }
            });
        }
        return last7Days;
    }, [dailyTasks]);

  const isLoading = isLoadingTopics || isLoadingTasks;

  if (isLoading) {
      return <div className="flex h-full w-full items-center justify-center"><LoaderCircle className="h-12 w-12 animate-spin text-primary" /></div>
  }

  return (
    <motion.div 
      className="flex flex-1 flex-col gap-4 md:gap-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4" variants={containerVariants}>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Chủ đề đang học
              </CardTitle>
              <BookCopy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.topicsInProgress}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Bài học hoàn thành
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedLessons}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bài kiểm tra đã qua</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.testsPassed}</div>
            </CardContent>
          </Card>
        </motion.div>
         <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chuỗi ngày học</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M12 9.5V2.5c-2.3.6-4 2.4-4 4.5 0 1.3.5 2.5 1.4 3.4L6.9 13c-2.8 2.9-2.8 7.5-.1 10.4 2.7 2.7 7.2 2.7 9.9-.1L19.1 21c.9-.9 1.4-2.1 1.4-3.4 0-2.1-1.7-4.2-4-4.8V9.5zM12 14.5v-5"/></svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.learningStreak} Ngày</div>
              <p className="text-xs text-muted-foreground">
                Cố gắng lên!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
      <motion.div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3" variants={containerVariants}>
        <motion.div variants={itemVariants} className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Tiếp tục học</CardTitle>
              <CardDescription>
                Chọn một chủ đề để tiếp tục.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chủ đề</TableHead>
                    <TableHead className="hidden sm:table-cell">Trạng thái</TableHead>
                    <TableHead className="hidden md:table-cell">Tiến độ</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {continueLearning.length > 0 ? continueLearning.map(topic => (
                    <TableRow key={topic.id}>
                        <TableCell>
                        <div className="font-medium">{topic.title}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                        <Badge className="text-xs" variant="secondary">
                            Đang học
                        </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                        {Math.round(topic.progress || 0)}%
                        </TableCell>
                        <TableCell className="text-right">
                        <Button size="sm" asChild>
                            <Link href={`/roadmap/${topic.id}`}>Tiếp tục</Link>
                        </Button>
                        </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">Chưa có chủ đề nào đang học.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Hoạt động tuần</CardTitle>
              <CardDescription>Số nhiệm vụ đã hoàn thành trong tuần này.</CardDescription>
            </CardHeader>
            <CardContent>
            {isLoadingTasks ? (
                <div className="flex h-[180px] w-full items-center justify-center">
                    <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[180px] w-full">
                <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                   <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="tasks" fill="var(--color-tasks)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

    