
import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'session';
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60; // 14 days in seconds
const COOKIE_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000; // 14 days in ms for createSessionCookie

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idToken = body?.idToken;
    
    if (!idToken || typeof idToken !== 'string') {
      console.error('[session.route] Missing or invalid idToken in request body');
      return NextResponse.json({ success: false, error: 'Missing idToken' }, { status: 400 });
    }

    // Log token format for debugging (first/last 10 chars only for security)
    console.log('[session.route] Received token format:', {
      length: idToken.length,
      preview: `${idToken.substring(0, 10)}...${idToken.substring(idToken.length - 10)}`
    });

    // Verify the ID token with more detailed error handling
    let decoded;
    try {
      // Don't check revoked on initial verification to speed things up
      decoded = await authAdmin.verifyIdToken(idToken, false);
      console.log('[session.route] Token verified successfully for user:', decoded.uid);
    } catch (verifyError: any) {
      console.error('[session.route] Token verification failed:', {
        code: verifyError.code,
        message: verifyError.message,
        tokenLength: idToken.length
      });
      
      if (verifyError.code === 'auth/id-token-expired') {
        return NextResponse.json({ 
          success: false, 
          error: 'Token expired. Please sign in again.' 
        }, { status: 401 });
      }
      if (verifyError.code === 'auth/argument-error') {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid token format. The token may be corrupted.' 
        }, { status: 401 });
      }
      if (verifyError.code === 'auth/invalid-id-token') {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid ID token. Please sign in again.' 
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `Token verification failed: ${verifyError.message}` 
      }, { status: 401 });
    }

    // Create session cookie
    let sessionCookie;
    try {
      sessionCookie = await authAdmin.createSessionCookie(idToken, { 
        expiresIn: COOKIE_EXPIRES_IN 
      });
      console.log('[session.route] Session cookie created successfully');
    } catch (cookieError: any) {
      console.error('[session.route] Failed to create session cookie:', cookieError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create session cookie' 
      }, { status: 500 });
    }

    // Check user's Gemini key status
    let status = 'unverified';
    try {
      const userDoc = await firestoreAdmin.doc(`users/${decoded.uid}`).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      status = userData?.geminiKeyVerified ? 'verified' : 'unverified';
      console.log('[session.route] User status:', status);
    } catch (firestoreError) {
      console.warn('[session.route] Failed to check Gemini key status:', firestoreError);
      // Continue anyway, status defaults to 'unverified'
    }

    const response = NextResponse.json({ success: true, status });
    
    // Set cookie with all necessary attributes
    response.cookies.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    
    console.log('[session.route] Session created successfully for user:', decoded.uid);
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
