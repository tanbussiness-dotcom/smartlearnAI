
import { NextResponse, type NextRequest } from 'next/server';

const UNPROTECTED_PATHS = ['/', '/login', '/signup', '/api/auth/session', '/api/auth/check-session', '/api/test-cookie', '/setup/gemini-key'];
const PUBLIC_FILES = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public files and Next.js assets to pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    PUBLIC_FILES.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Handle CORS preflight requests globally
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  }

  const isProtectedRoute = !UNPROTECTED_PATHS.some(path => pathname.startsWith(path) && path !== '/');
  const sessionCookie = request.cookies.get('session')?.value;
  let response = NextResponse.next();

  if (isProtectedRoute && !sessionCookie) {
    console.log(`[Middleware] No session for protected route '${pathname}'.`);
    
    // If the request is for an API route, return 401 JSON instead of redirecting
    if (pathname.startsWith('/api/')) {
        console.log(`[Middleware] Returning 401 JSON for API route.`);
        return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const loginUrl = new URL(`/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    console.log(`[Middleware] Redirecting to login page.`);
    response = NextResponse.redirect(loginUrl);
  }

  if (isProtectedRoute && sessionCookie) {
      const statusUrl = new URL('/api/auth/check-status', request.url);
      const statusResponse = await fetch(statusUrl, {
        headers: { 'Cookie': `session=${sessionCookie}` }
      });

      // If check-status itself fails, let's not block the user but log it.
      if(statusResponse.ok) {
        const { status } = await statusResponse.json();
        if (status !== 'verified' && pathname !== '/setup/gemini-key') {
            console.log(`[Middleware] User status is '${status}' for protected route '${pathname}'. Redirecting to Gemini setup.`);
            response = NextResponse.redirect(new URL('/setup/gemini-key', request.url));
        }
      } else {
         console.warn(`[Middleware] WARN: Call to /api/auth/check-status failed with status ${statusResponse.status}. Allowing request to proceed.`);
      }
  }
  
  // Apply CORS headers to all outgoing responses
  response.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
