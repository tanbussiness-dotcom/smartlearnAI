
"use client"
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle, BookCopy, Target, LoaderCircle } from "lucide-react";
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
import { format, subDays, startOfDay } from 'date-fns';

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
                if (task.status === 'Completed') {
                    const taskDateStr = task.date.split('T')[0];
                    const dayEntry = last7Days.find(d => d.date === taskDateStr);
                    if (dayEntry) {
                        dayEntry.tasks += 1;
                    }
                }
            });
        }
        return last7Days;
    }, [dailyTasks]);

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
                Topics in Progress
              </CardTitle>
              <BookCopy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                +2 from last month
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Completed Lessons
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45</div>
              <p className="text-xs text-muted-foreground">
                +12 this week
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tests Passed</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                85% average score
              </p>
            </CardContent>
          </Card>
        </motion.div>
         <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Streak</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M12 9.5V2.5c-2.3.6-4 2.4-4 4.5 0 1.3.5 2.5 1.4 3.4L6.9 13c-2.8 2.9-2.8 7.5-.1 10.4 2.7 2.7 7.2 2.7 9.9-.1L19.1 21c.9-.9 1.4-2.1 1.4-3.4 0-2.1-1.7-4.2-4-4.8V9.5zM12 14.5v-5"/></svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5 Days</div>
              <p className="text-xs text-muted-foreground">
                Keep it up!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
      <motion.div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3" variants={containerVariants}>
        <motion.div variants={itemVariants} className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Continue Learning</CardTitle>
              <CardDescription>
                Pick up where you left off.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Progress</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="font-medium">Python for Data Science</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        Next: Functions
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className="text-xs" variant="secondary">
                        Learning
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      35%
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" asChild>
                        <Link href="/roadmap/python">Resume</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="font-medium">Digital Marketing</div>
                       <div className="hidden text-sm text-muted-foreground md:inline">
                        Next: SEO Basics
                      </div>
                    </TableCell>
                     <TableCell className="hidden sm:table-cell">
                      <Badge className="text-xs" variant="secondary">
                        Learning
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      75%
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" asChild>
                        <Link href="/roadmap/digital-marketing">Resume</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Weekly Activity</CardTitle>
              <CardDescription>These are your completed tasks for this week.</CardDescription>
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

    