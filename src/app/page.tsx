import Link from 'next/link';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { HomePageSearch } from './home-page-search';

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-50 flex h-16 w-full shrink-0 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-sm md:px-6">
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
        <section className="container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
          <div className="mx-auto w-full max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl font-headline">
              What do you want to learn today?
            </h1>
            <p className="mt-4 max-w-[700px] mx-auto text-lg text-muted-foreground md:text-xl">
              SmartLearn AI generates personalized learning paths on any topic, helping you master new skills faster than ever before.
            </p>
            <HomePageSearch />
          </div>
        </section>
      </main>
    </div>
  );
}
