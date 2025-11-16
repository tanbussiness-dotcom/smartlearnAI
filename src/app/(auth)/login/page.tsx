
'use client';

import {
  Auth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  User,
  UserCredential,
} from 'firebase/auth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

async function handleLoginSuccess(user: User, redirect: string | null, router: any, toast: (options: any) => void) {
  try {
    // Force token refresh to ensure we have a valid, fresh token
    const idToken = await user.getIdToken(true); // true forces refresh
    
    // Small delay to ensure auth state is fully propagated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 1. Set session cookie via API route
    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });

    if (!sessionResponse.ok) {
      const errorData = await sessionResponse.json().catch(() => null);
      console.error('Session creation failed:', errorData);
      throw new Error(errorData?.error || 'Không thể thiết lập phiên đăng nhập. Vui lòng thử lại.');
    }

    const sessionData = await sessionResponse.json();
    if (!sessionData.success) {
      throw new Error(sessionData.error || 'Thiết lập phiên thất bại.');
    }

    // 2. Verify that the cookie was actually set
    const checkResponse = await fetch('/api/auth/check-session', {
      credentials: 'include'
    });
    
    if (checkResponse.ok) {
      const { valid: isCookieSet } = await checkResponse.json();
      if (!isCookieSet) {
        toast({
          variant: 'destructive',
          title: '⚠️ Không thể thiết lập cookie',
          description: 'Vui lòng kiểm tra cài đặt trình duyệt của bạn để cho phép cookie.',
          duration: 9000,
        });
        return;
      }
    }
    
    // 3. Determine redirect based on session status
    let targetPage = redirect || '/dashboard';
    if (sessionData.status === 'unverified') {
      targetPage = '/setup/gemini-key';
    }

    console.log("🔐 Post-login redirect:", targetPage);
    
    // Small delay before redirect to ensure everything is settled
    await new Promise(resolve => setTimeout(resolve, 100));
    router.push(targetPage);

  } catch(error: any) {
    console.error('Login error details:', error);
    toast({
      variant: 'destructive',
      title: 'Lỗi sau đăng nhập',
      description: error.message || 'Đã có lỗi xảy ra trong quá trình thiết lập phiên của bạn.',
    });
  }
}

async function socialSignIn(auth: Auth, provider: any): Promise<UserCredential | null> {
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
        // Fallback to redirect for environments where popups are blocked.
        // Note: The result of this is handled when the page reloads.
        await signInWithRedirect(auth, provider);
        return null;
    } else {
        console.error('Social Sign-In Error:', error);
        throw error;
    }
  }
}

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const { toast } = useToast();

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = event.currentTarget.email.value;
    const password = event.currentTarget.password.value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleLoginSuccess(userCredential.user, redirect, router, toast);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Đăng nhập thất bại',
        description: 'Email hoặc mật khẩu không chính xác.',
      });
    }
  };

  const handleSocialSignIn = async (provider: GoogleAuthProvider | OAuthProvider) => {
    try {
      const result = await socialSignIn(auth, provider);
      if(result?.user) {
        await handleLoginSuccess(result.user, redirect, router, toast);
      }
      // If result is null, it means a redirect is in progress. No further action needed here.
    } catch (error: any) {
       toast({
        variant: 'destructive',
        title: 'Đăng nhập thất bại',
        description: error.message || 'Đã xảy ra lỗi với nhà cung cấp dịch vụ xã hội.',
      });
    }
  }

  const handleGoogleSignIn = () => {
    const provider = new GoogleAuthProvider();
    handleSocialSignIn(provider);
  };
  
  const handleAppleSignIn = () => {
    const provider = new OAuthProvider('apple.com');
    handleSocialSignIn(provider);
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Đăng nhập tài khoản</CardTitle>
          <CardDescription>
            Nhập email của bạn để đăng nhập
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-6">
            <Button variant="outline" onClick={handleAppleSignIn}>
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4"><title>Apple</title><path d="M12.152 6.896c-.922 0-1.854.49-2.583 1.238-.729.748-1.221 1.73-1.221 2.818 0 .22.031.439.092.658h3.712c.01-.22.041-.439.041-.658 0-1.088-.523-2.07-1.262-2.818-.74-.748-1.652-1.238-2.58-1.238zm1.09-2.455c.66-.717 1.139-1.651 1.139-2.738 0-.158-.01-.316-.041-.443h-4.992c-.718 1.248-1.049 2.518-1.049 3.848 0 .688.131 1.346.383 1.965.433.989 1.162 1.843 2.122 2.5.95.647 2.062 1.02 3.235 1.02.43 0 .85-.05 1.251-.158.158-.03.316-.08.463-.129-.208.119-.427.238-.646.347-.84.448-1.742.687-2.672.687-1.29 0-2.55-.42-3.62-1.238-.97-.718-1.732-1.7-2.224-2.858-.482-1.157-.721-2.386-.721-3.666s.239-2.509.721-3.666c.492-1.158 1.254-2.14 2.224-2.858C8.98 0 10.24 0 10.24 0c.03 1.405.61 2.76 1.631 3.966.52.617.84 1.205 1.04 1.835-.66.717-1.139 1.651-1.139 2.738 0 .158.01.316.041.443h4.992c.718-1.248 1.049 2.518 1.049-3.848 0-.688-.131-1.346-.383-1.965-.433-.989-1.162-1.843-2.122-2.5-.95-.647-2.062-1.02-3.235-1.02-.43 0-.85-.05-1.251-.158-.158.03-.316-.08-.463-.129.208-.119.427.238-.646.347.84-.448 1.742.687-2.672.687 1.29 0 2.55.42 3.62 1.238.97.718 1.732 1.7 2.224 2.858.482-1.157.721 2.386.721-3.666s-.239 2.509-.721-3.666c-.492-1.158-1.254-2.14-2.224-2.858-1.07 1.02-2.33 1.238-3.62 1.238-1.09 0-2.15-.316-3.11-.939l-.168-.1c-.198-.129-.396-.258-.563-.396-.07-.05-.14-.11-.2-.16a.54.54 0 0 1-.03-.02c-.52-.42-1.01-.89-1.44-1.4l-.19-.24c-.03-.04-.06-.08-.09-.12a_small_buf_for_rounding_error_0.001-c.4-.48-.77-.98-1.1-1.52-.33-.53-.6-1.08-.8-1.66-.2-.58-.3-1.18-.3-1.78 0-2.29 1.04-4.32 2.72-5.71a.03.03 0 0 0 0-.01zM11.532 9.9c.492 0 .973.1 1.413.316.44.216.82.522 1.141.918.32.396.561.851.721 1.366h-6.55c.18-1.196.881-2.178 1.956-2.56.43-.168.88-.24 1.319-.24z"/></svg>
              Apple
            </Button>
            <Button variant="outline" onClick={handleGoogleSignIn}>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.91l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.91z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.223,0-9.65-3.317-11.29-7.962l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.37,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
              Google
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Hoặc tiếp tục với
              </span>
            </div>
          </div>
          <form onSubmit={handleEmailLogin} className="grid gap-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="m@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" name="password" />
            </div>
            <Button type="submit" className="w-full">
              Đăng nhập
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Chưa có tài khoản?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  );
}
