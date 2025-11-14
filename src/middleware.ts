
import { NextResponse, type NextRequest } from 'next/server';
import { authAdmin, firestoreAdmin } from './firebase/admin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define protected routes that require a Gemini API key
  const protectedRoutes = ['/dashboard', '/search', '/roadmap', '/lesson'];

  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      // If no session cookie, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    try {
      // Verify the session cookie to get the user
      const decodedToken = await authAdmin.verifySessionCookie(sessionCookie, true);
      const userId = decodedToken.uid;

      // Check for Gemini API key in Firestore
      const userDocRef = firestoreAdmin.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists || !userDoc.data()?.geminiKey) {
        // If no key, redirect to API settings page
        const url = request.nextUrl.clone();
        url.pathname = '/settings/api';
        return NextResponse.redirect(url);
      }
    } catch (error) {
      // If cookie is invalid or expired, clear it and redirect to login
      console.error('[Middleware] Auth error:', error);
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(url);
      response.cookies.delete('session');
      return response;
    }
  }

  // If not a protected route or checks pass, continue
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - / (homepage)
     * - /login
     * - /signup
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|signup|auth|\\.).*)',
  ],
};
