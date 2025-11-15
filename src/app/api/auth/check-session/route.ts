import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session');

  if (sessionCookie) {
    return NextResponse.json({
      valid: true,
      message: 'Session cookie found',
    });
  } else {
    return NextResponse.json({
      valid: false,
      message: 'Session cookie not found',
    });
  }
}
