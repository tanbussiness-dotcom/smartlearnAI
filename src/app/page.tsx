import Link from 'next/link';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
            <div className="mt-8 relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="e.g., 'Learn Python from scratch' or 'Basics of cooking'"
                  className="w-full pl-12 pr-28 h-14 text-lg rounded-full shadow-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement;
                        const query = encodeURIComponent(target.value);
                        window.location.href = `/search?topic=${query}`;
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  size="lg" 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full h-10" 
                  asChild
                >
                  <Link href="/search" onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.parentElement?.querySelector('input');
                      if (input?.value) {
                          e.currentTarget.href = `/search?topic=${encodeURIComponent(input.value)}`;
                      } else {
                        e.preventDefault();
                        input?.focus();
                      }
                  }}>Generate</Link>
                </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
