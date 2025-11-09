'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ExternalLink } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type Source = {
  title: string;
  url: string;
  domain: string;
  snippet?: string; // Đoạn trích hoặc ghi chú ngắn
};

type SourceViewerProps = {
  source: Source;
};

export function SourceViewer({ source }: SourceViewerProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleMarkAsUseful = async () => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Bạn phải đăng nhập để thực hiện hành động này.',
      });
      return;
    }

    try {
      const feedbackCollection = collection(firestore, 'source_feedback');
      await addDoc(feedbackCollection, {
        userId: user.uid,
        sourceUrl: source.url,
        sourceTitle: source.title,
        markedAt: new Date().toISOString(),
      });

      toast({
        title: 'Cảm ơn bạn!',
        description: 'Phản hồi của bạn đã được ghi lại.',
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        variant: 'destructive',
        title: 'Đã có lỗi xảy ra',
        description: 'Không thể lưu phản hồi. Vui lòng thử lại.',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-headline">{source.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{source.domain}</p>
      </CardHeader>
      {source.snippet && (
        <CardContent>
          <p className="text-sm italic">"{source.snippet}"</p>
        </CardContent>
      )}
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleMarkAsUseful}>
          <ThumbsUp className="mr-2 h-4 w-4" />
          Đánh dấu hữu ích
        </Button>
        <Button asChild size="sm">
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Mở trang gốc
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
