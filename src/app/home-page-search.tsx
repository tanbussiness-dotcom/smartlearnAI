'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function HomePageSearch() {
  const router = useRouter();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLAnchorElement>) => {
    let inputElement: HTMLInputElement | null = null;
    if (e.currentTarget instanceof HTMLInputElement) {
        inputElement = e.currentTarget;
    } else {
        inputElement = (e.currentTarget as HTMLElement).parentElement?.parentElement?.querySelector('input');
    }
    
    if (!inputElement) return;

    if ('key' in e && e.key !== 'Enter') {
      return;
    }
    
    e.preventDefault();

    const query = encodeURIComponent(inputElement.value);
    if(query) {
        router.push(`/search?topic=${query}`);
    } else {
        inputElement.focus();
    }
  };

  return (
    <div className="mt-8 relative max-w-xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        type="search"
        placeholder="e.g., 'Learn Python from scratch' or 'Basics of cooking'"
        className="w-full pl-12 pr-28 h-14 text-lg rounded-full shadow-lg"
        onKeyDown={handleSearch}
      />
      <Button
        type="submit"
        size="lg"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full h-10"
        asChild
      >
        <Link href="/search" onClick={handleSearch}>
          Generate
        </Link>
      </Button>
    </div>
  );
}
