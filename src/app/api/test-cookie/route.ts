
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    console.log(`[Test Cookie] Request received from origin: ${origin}`);

    // Build the response first
    const response = NextResponse.json({
      message: "Attempting to set 'cookie_test'. Check your browser's 'Application' > 'Cookies' tab.",
      origin: origin,
      timestamp: new Date().toISOString(),
    });

    // Set the cookie on the response object
    response.cookies.set('cookie_test', 'ok', {
      httpOnly: true,
      secure: true,
      sameSite: 'none', // Required for cross-site contexts
      path: '/',
      maxAge: 60 * 5, // 5 minutes
    });

    // Log the header that will be sent
    console.log('[Test Cookie] Set-Cookie header:', response.headers.get('set-cookie'));

    return response;

  } catch (error: any) {
    console.error("[Test Cookie] Error setting cookie:", error);
    return NextResponse.json(
      {
        message: "Failed to set cookie.",
        error: error.message,
        hint: "This can happen if the browser blocks the cookie due to SameSite policies. Ensure you are accessing this via a secure (HTTPS) context if 'secure: true' is used.",
      },
      { status: 500 }
    );
  }
}
