import Link from 'next/link';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-50 flex h-16 w-full shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
          <div className="mx-auto flex max-w-[980px] flex-col items-start gap-2">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
              Unlock Your Potential with <br className="hidden sm:inline" />
              AI-Powered Learning Roadmaps
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground">
              SmartLearn AI generates personalized learning paths on any topic,
              helping you master new skills faster than ever before.
            </p>
          </div>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/signup">Get Started for Free</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
