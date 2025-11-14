'use client';
import { useState, useEffect } from 'react';
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
import { LoaderCircle, CheckCircle, XCircle } from 'lucide-react';
import { saveGeminiKey } from '@/lib/actions/gemini-key';
import { useRouter } from 'next/navigation';

type KeyStatus = {
  hasKey: boolean;
  lastUpdated: string | null;
}

export default function GeminiApiSettingsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [apiKey, setApiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchKeyStatus = async () => {
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
        const idToken = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/user/gemini-key', {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            setKeyStatus(data);
        } else {
            toast({ variant: "destructive", title: "Could not fetch API key status." });
        }
    } catch (error) {
        toast({ variant: "destructive", title: "Error fetching key status." });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
        fetchKeyStatus();
    }
  }, [auth.currentUser]);

  const handleUpdateKey = async () => {
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

    setIsUpdating(true);
    try {
      const result = await saveGeminiKey(apiKey);

      if (result.success) {
        toast({
          title: '✅ Đã cập nhật và xác thực thành công!',
        });
        setApiKey(''); // Clear input field
        fetchKeyStatus(); // Refresh status
      } else {
        throw new Error(result.message || 'Xác thực thất bại. Vui lòng kiểm tra lại khóa của bạn.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '❌ Khóa Gemini không hợp lệ',
        description: error.message || 'Vui lòng thử lại.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-3xl font-headline font-bold mb-6">Cài đặt API</h1>
        <Card>
        <CardHeader>
            <CardTitle>Quản lý khóa Gemini API</CardTitle>
            <CardDescription>
                Cập nhật hoặc thay đổi khóa Gemini API của bạn. Khóa này được sử dụng để cung cấp năng lượng cho tất cả các tính năng AI trong ứng dụng.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg">Trạng thái khóa hiện tại</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center space-x-2">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            <span>Đang tải trạng thái...</span>
                        </div>
                    ) : keyStatus?.hasKey ? (
                        <div className="flex items-center text-green-600 dark:text-green-400">
                           <CheckCircle className="h-5 w-5 mr-2" />
                           <span className="font-medium">Đã xác thực. Cập nhật lần cuối: {keyStatus.lastUpdated ? new Date(keyStatus.lastUpdated).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    ) : (
                        <div className="flex items-center text-destructive">
                           <XCircle className="h-5 w-5 mr-2" />
                           <span className="font-medium">Chưa xác thực hoặc chưa có khóa</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-2">
                <label htmlFor="apiKey" className="font-medium">Khóa API mới</label>
                <Input
                id="apiKey"
                type="password"
                value={apiKey}
                placeholder="Dán khóa API Gemini mới của bạn vào đây..."
                onChange={(e) => setApiKey(e.target.value)}
                className="text-base"
                disabled={isUpdating}
                />
            </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
            <Button onClick={handleUpdateKey} className="w-full" disabled={isUpdating || !apiKey}>
            {isUpdating ? (
                <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Đang xác thực...
                </>
            ) : (
                'Xác thực và Cập nhật'
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
    </div>
  );
}
