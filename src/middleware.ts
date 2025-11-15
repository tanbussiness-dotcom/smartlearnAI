
import { NextResponse, type NextRequest } from 'next/server';
// DO NOT import 'authAdmin' from '@/firebase/admin' here.
// The middleware runs on the Edge and cannot use Node.js-specific modules.

// List of routes that do not require authentication
const UNPROTECTED_PATHS = ['/', '/login', '/signup', '/api/', '/_next', '/favicon.ico', '/setup/gemini-key'];

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  const pathname = request.nextUrl.pathname;

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const preflightResponse = new Response(null, { status: 204 });
    preflightResponse.headers.set('Access-Control-Allow-Origin', origin);
    preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    return preflightResponse;
  }
  
  // Check if the path is protected
  const isProtectedRoute = !UNPROTECTED_PATHS.some(path => {
    if (path === '/') return pathname === '/';
    // Match /api/ but not /api/auth/* etc. so we make it more specific
    if (path === '/api/') return pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/test-cookie');
    return pathname.startsWith(path);
  });

  let response: NextResponse;
  
  // The actual verification of the cookie is handled by the server-side API routes
  // or server components that use the Admin SDK. The middleware's job is to
  // simply redirect if the cookie is missing for protected routes.
  if (isProtectedRoute) {
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      // Redirect to login if no session cookie
      const loginUrl = new URL(`/login`, request.url)
      loginUrl.searchParams.set('redirect', pathname);
      response = NextResponse.redirect(loginUrl);
    } else {
      // If cookie exists, let the request through. 
      // Server-side logic will handle the actual validation.
      response = NextResponse.next();
    }
  } else {
    // For unprotected routes, just let them pass
    response = NextResponse.next();
  }

  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
}

export const config = {
  // Apply middleware to all routes except for static files and image optimization
  matcher: [
    '/((?!static|.*\\..*|_next/static|_next/image).*)',
  ],
};
