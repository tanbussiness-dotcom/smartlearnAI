import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogoProps = React.HTMLAttributes<HTMLDivElement>;

export default function Logo({ className, ...props }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <GraduationCap className="h-6 w-6 text-primary" />
      <span className="text-xl font-bold font-headline text-foreground">
        SmartLearn AI
      </span>
    </div>
  );
}
