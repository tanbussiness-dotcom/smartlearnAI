import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'session';
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60; // 14 days in seconds
const COOKIE_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000; // 14 days in ms for createSessionCookie

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idToken = body?.idToken;
    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Missing idToken' }, { status: 400 });
    }

    const decoded = await authAdmin.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid idToken' }, { status: 401 });
    }

    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn: COOKIE_EXPIRES_IN });

    const userDoc = await firestoreAdmin.doc(`users/${decoded.uid}`).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const status = userData?.geminiKeyVerified ? 'verified' : 'unverified';

    const response = NextResponse.json({ success: true, status });
    
    response.cookies.set({
        name: COOKIE_NAME,
        value: sessionCookie,
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
    });
    
    const origin = req.headers.get('origin') || '*';
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;

  } catch (err: any) {
    console.error('[session.route] error', err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0,
  });

  const origin = req.headers.get('origin') || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}
