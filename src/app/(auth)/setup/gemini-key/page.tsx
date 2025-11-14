'use client';
import { useState } from 'react';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GeminiKeySetupPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyAndContinue = async () => {
    if (!apiKey) {
      toast({
        variant: 'destructive',
        title: 'Vui lòng nhập API key',
      });
      return;
    }
    if (!auth.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Lỗi xác thực',
        description: 'Vui lòng đăng nhập lại và thử lại.',
      });
      router.push('/login');
      return;
    }

    setIsVerifying(true);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch('/api/user/gemini-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ apiKey }),
      });

      if (res.ok) {
        toast({
          title: '✅ Đã xác thực và lưu thành công!',
          description: 'Bây giờ bạn có thể bắt đầu hành trình học tập của mình.',
        });
        router.push('/dashboard');
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Xác thực thất bại. Vui lòng kiểm tra lại khóa của bạn.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '❌ Khóa Gemini không hợp lệ',
        description: 'Vui lòng thử lại.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Nhập khóa Gemini API của bạn</CardTitle>
        <CardDescription>
          Để tiếp tục, bạn cần cung cấp khóa API của riêng mình để sử dụng các tính năng AI không giới hạn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="text"
          value={apiKey}
          placeholder="Nhập Google AI Gemini API Key của bạn..."
          onChange={(e) => setApiKey(e.target.value)}
          className="text-base"
          disabled={isVerifying}
        />
        <p className="text-xs text-muted-foreground">
          Khóa của bạn sẽ được mã hóa và lưu trữ an toàn. Chúng tôi không bao giờ chia sẻ nó với bất kỳ ai.
        </p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4">
        <Button onClick={handleVerifyAndContinue} className="w-full" disabled={isVerifying}>
          {isVerifying ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Đang xác thực...
            </>
          ) : (
            'Xác thực và Tiếp tục'
          )}
        </Button>
        <div className="text-center text-sm">
            <Link
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                className="font-medium text-primary hover:underline"
            >
                Nhận Gemini API Key từ Google AI Studio
            </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
