
import { NextRequest, NextResponse } from 'next/server';
import cookie from 'cookie';
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

    // Verify the ID token with more detailed error handling
    let decoded;
    try {
      decoded = await authAdmin.verifyIdToken(idToken, true); // checkRevoked = true
    } catch (verifyError: any) {
      console.error('[session.route] Token verification failed:', verifyError.code, verifyError.message);
      
      if (verifyError.code === 'auth/id-token-expired') {
        return NextResponse.json({ success: false, error: 'Token expired. Please sign in again.' }, { status: 401 });
      }
      if (verifyError.code === 'auth/argument-error') {
        return NextResponse.json({ success: false, error: 'Invalid token format.' }, { status: 401 });
      }
      
      return NextResponse.json({ success: false, error: 'Invalid idToken' }, { status: 401 });
    }

    // Create session cookie with a longer expiration
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { 
      expiresIn: COOKIE_EXPIRES_IN 
    });

    // Check user's Gemini key status
    const userDoc = await firestoreAdmin.doc(`users/${decoded.uid}`).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const status = userData?.geminiKeyVerified ? 'verified' : 'unverified';

    const response = NextResponse.json({ success: true, status });
    
    // Set cookie with all necessary attributes
    response.cookies.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: 'lax', // Changed from 'none' to 'lax' for better compatibility
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    
    return response;

  } catch (err: any) {
    console.error('[session.route] Unexpected error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err?.message || 'Internal error' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
  });

  const origin = req.headers.get('origin') || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

    