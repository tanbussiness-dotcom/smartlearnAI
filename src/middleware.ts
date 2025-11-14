
import { NextResponse, type NextRequest } from 'next/server';
import { authAdmin } from '@/firebase/admin';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL(`/login?redirect=${request.nextUrl.pathname}`, request.url));
  }

  try {
    // Verify the session cookie. This will throw an error if invalid.
    await authAdmin.verifySessionCookie(sessionCookie, true);
    return NextResponse.next();
  } catch (error) {
    // Session cookie is invalid. Clear it and redirect to login.
    const response = NextResponse.redirect(new URL(`/login?redirect=${request.nextUrl.pathname}`, request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/lesson/:path*',
    '/quiz/:path*',
    '/roadmap/:path*',
    '/search/:path*',
    '/settings/:path*',
  ],
};
