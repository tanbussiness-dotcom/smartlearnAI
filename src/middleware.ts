
import { NextResponse, type NextRequest } from 'next/server';
import { authAdmin } from '@/firebase/admin';

// Danh sách các đường dẫn không yêu cầu xác thực
const UNPROTECTED_PATHS = ['/login', '/signup', '/api/auth', '/api/test-cookie', '/_next', '/favicon.ico'];

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  const pathname = request.nextUrl.pathname;

  // Xử lý yêu cầu OPTIONS (preflight) cho CORS
  if (request.method === 'OPTIONS') {
    const preflightResponse = new Response(null, { status: 204 });
    preflightResponse.headers.set('Access-Control-Allow-Origin', origin);
    preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    console.log(`[Middleware] Handled OPTIONS preflight for: ${pathname}`);
    return preflightResponse;
  }
  
  // Xác định xem đường dẫn có được bảo vệ hay không
  const isProtectedRoute = !UNPROTECTED_PATHS.some(path => pathname.startsWith(path));

  let response: NextResponse;

  if (isProtectedRoute) {
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      // Chuyển hướng đến trang đăng nhập nếu không có session
      response = NextResponse.redirect(new URL(`/login?redirect=${pathname}`, request.url));
    } else {
      try {
        // Xác thực session cookie
        await authAdmin.verifySessionCookie(sessionCookie, true);
        // Nếu hợp lệ, cho phép tiếp tục
        response = NextResponse.next();
        console.log(`[Middleware] User authenticated for protected route: ${pathname}`);
      } catch (error) {
        // Nếu không hợp lệ, xóa cookie và chuyển hướng đến trang đăng nhập
        console.warn(`[Middleware] Invalid session cookie. Redirecting to login.`);
        response = NextResponse.redirect(new URL(`/login?redirect=${pathname}`, request.url));
        response.cookies.delete('session');
      }
    }
  } else {
    // Đối với các đường dẫn không được bảo vệ, cho phép đi qua
    response = NextResponse.next();
  }

  // Thêm các header CORS vào tất cả các phản hồi
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
}

export const config = {
  // Áp dụng middleware cho tất cả các đường dẫn trừ các tệp tĩnh của Next.js
  matcher: [
    '/((?!api/static|static|.*\\..*|_next/static|_next/image).*)',
  ],
};
