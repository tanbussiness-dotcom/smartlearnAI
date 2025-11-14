
import { NextResponse, type NextRequest } from 'next/server';
import { authAdmin } from '@/firebase/admin';
import { cookies } from 'next/headers';

// Helper function to verify the token and get user ID
async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const decodedToken = await authAdmin.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    return null;
  }
}

// Function to check if the user has a Gemini key
async function userHasGeminiKey(userId: string): Promise<boolean> {
  try {
    const { firestoreAdmin } = await import('@/firebase/admin');
    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return !!userDoc.data()?.geminiKey;
    }
    return false;
  } catch (error) {
    console.error('Middleware: Error checking user key in Firestore:', error);
    return false; // Fail safe
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('session')?.value;

  const protectedPaths = ['/dashboard', '/search', '/roadmap', '/lesson', '/quiz'];
  const isProtectedPath = protectedPaths.some(p => pathname.startsWith(p));

  // If it's not a protected path, let it through.
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // --- Handle protected paths ---

  // 1. If no session token, redirect to login
  if (!sessionToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Verify token
  const userId = await getUserIdFromToken(sessionToken);
  if (!userId) {
    // Invalid token, redirect to login and clear the bad cookie
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }

  // 3. Check for Gemini Key, but NOT on the settings page itself
  if (pathname !== '/settings/api') {
    const hasKey = await userHasGeminiKey(userId);
    if (!hasKey) {
      // User is logged in but has no key, redirect to settings
      const url = request.nextUrl.clone();
      url.pathname = '/settings/api';
      return NextResponse.redirect(url);
    }
  }
  
  // All checks passed, allow the request
  return NextResponse.next();
}

export const config = {
  // Match all paths except for static files, API routes, and auth pages.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|signup|sw.js).*)',
  ],
};
