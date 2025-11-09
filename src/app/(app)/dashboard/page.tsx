"use client"
import Link from "next/link";
import { ArrowUpRight, CheckCircle, BookCopy, Target } from "lucide-react";

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
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

const chartData = [
  { day: "Monday", tasks: 1, desktop: 186 },
  { day: "Tuesday", tasks: 2, desktop: 305 },
  { day: "Wednesday", tasks: 1, desktop: 237 },
  { day: "Thursday", tasks: 3, desktop: 73 },
  { day: "Friday", tasks: 2, desktop: 209 },
  { day: "Saturday", tasks: 4, desktop: 214 },
  { day: "Sunday", tasks: 1, desktop: 214 },
];

const chartConfig = {
  tasks: {
    label: "Tasks",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function Dashboard() {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
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
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>These are your completed tasks for this week.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[180px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                 <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="tasks" fill="var(--color-tasks)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
