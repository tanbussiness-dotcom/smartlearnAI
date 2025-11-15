
import { NextResponse, type NextRequest } from 'next/server';

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
    // More specific matching for API routes
    if (path === '/api/') {
      return pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/test-cookie');
    }
    return pathname.startsWith(path);
  });

  const sessionCookie = request.cookies.get('session')?.value;
  let response: NextResponse;

  if (isProtectedRoute) {
    if (!sessionCookie) {
      // Redirect to login if no session cookie
      const loginUrl = new URL(`/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      console.log(`[Middleware] No session for protected route '${pathname}'. Redirecting to login.`);
      response = NextResponse.redirect(loginUrl);
    } else {
      // If cookie exists, verify key status before allowing access
      const statusUrl = new URL('/api/auth/check-status', request.url);
      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Cookie': `session=${sessionCookie}`
        }
      });
      const { status } = await statusResponse.json();

      if (status !== 'verified') {
        console.log(`[Middleware] User status is '${status}' for protected route '${pathname}'. Redirecting to Gemini setup.`);
        response = NextResponse.redirect(new URL('/setup/gemini-key', request.url));
      } else {
        // User is verified, proceed
        console.log(`[Middleware] User is verified. Allowing access to '${pathname}'.`);
        response = NextResponse.next();
      }
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
    '/((?!_next/static|_next/image|static|.*\\..*).*)',
  ],
};
