"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ApiSettings() {
  const { auth } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchKeyStatus = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/user/gemini-key", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHasKey(data.hasKey);
        if (data.lastUpdated) {
            setLastUpdated(new Date(data.lastUpdated).toLocaleString('vi-VN'));
        }
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Không thể tải trạng thái khóa' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      fetchKeyStatus();
    }
  }, [auth.currentUser]);

  const handleSave = async () => {
    if (!apiKey) {
      toast({ variant: 'destructive', title: 'Vui lòng nhập API key' });
      return;
    }
    setIsSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/user/gemini-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ apiKey }),
      });
      if (res.ok) {
        toast({ title: '✅ Đã lưu thành công!' });
        setApiKey("");
        await fetchKeyStatus(); // Re-fetch status
        router.push('/dashboard'); // Redirect to dashboard on success
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Lưu thất bại.");
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex justify-center items-start pt-12">
        <Card className="w-full max-w-lg">
        <CardHeader>
            <CardTitle className="text-2xl font-headline">🔑 Cài đặt Gemini API Key</CardTitle>
            <CardDescription>
                {hasKey 
                    ? "Bạn đã cung cấp khóa API. Để cập nhật, chỉ cần nhập khóa mới và lưu lại."
                    : "Để bắt đầu, bạn cần cung cấp khóa API của riêng mình để sử dụng các tính năng AI không giới hạn. Khóa của bạn sẽ được mã hóa và lưu trữ an toàn."
                }
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {hasKey && lastUpdated && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg p-3 text-sm">
                Khóa API của bạn được cập nhật lần cuối vào: {lastUpdated}.
            </div>
            )}
            <Input
                type="password"
                value={apiKey}
                placeholder="Nhập Google AI Gemini API Key của bạn..."
                onChange={(e) => setApiKey(e.target.value)}
                className="text-base"
                disabled={isSaving}
            />
             <p className="text-xs text-muted-foreground">
                Bạn có thể lấy API key từ <Link href="https://aistudio.google.com/app/apikey" target="_blank" className="underline hover:text-primary">Google AI Studio</Link>.
            </p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4">
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? (
                <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</>
            ) : (
                hasKey ? 'Cập nhật API Key' : 'Lưu và tiếp tục'
            )}
            </Button>
            {hasKey && (
                 <Button variant="ghost" size="sm" className="w-full" onClick={() => router.push('/dashboard')}>
                    Bỏ qua và vào Dashboard
                </Button>
            )}
        </CardFooter>
        </Card>
    </div>
  );
}
