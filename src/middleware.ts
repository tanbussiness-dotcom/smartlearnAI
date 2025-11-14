import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/lesson/:path*',
    '/quiz/:path*',
    '/roadmap/:path*',
    '/search/:path*',
    // Exclude API routes from this middleware
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  // Define public routes that don't require any checks
  const publicRoutes = ['/login', '/signup', '/'];
  if (publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }
  
  // Routes that require authentication and API key
  const protectedRoutes = ['/dashboard', '/lesson', '/quiz', '/roadmap', '/search'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL(`/login?redirect=${pathname}`, request.url));
    }
    
    // Call the internal API to check auth status, because middleware can't use firebase-admin
    const absoluteUrl = new URL('/api/auth/check-status', request.url);
    const response = await fetch(absoluteUrl, {
      headers: {
        'Cookie': `session=${sessionCookie}`
      }
    });

    const { status } = await response.json();

    if (status === 'unauthenticated') {
      return NextResponse.redirect(new URL(`/login?redirect=${pathname}`, request.url));
    }

    if (status === 'unverified') {
      // If user is trying to access a protected route without a verified key, redirect them to setup.
      if (pathname !== '/setup/gemini-key') {
         return NextResponse.redirect(new URL('/setup/gemini-key', request.url));
      }
    }
  }

  return NextResponse.next();
}
