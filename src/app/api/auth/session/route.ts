import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin') || '';
    const isLocalhost =
      origin.includes('localhost') || origin.includes('127.0.0.1');

    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'Missing ID token' },
        { status: 400 }
      );
    }

    // Verify ID token (no second parameter!)
    const decoded = await authAdmin.verifyIdToken(idToken);

    if (!decoded?.uid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing UID' },
        { status: 401 }
      );
    }

    const uid = decoded.uid;

    // Create session cookie
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    const sessionCookie = await authAdmin.createSessionCookie(idToken, {
      expiresIn,
    });

    // Check Gemini API key verification state
    const snap = await firestoreAdmin.collection('users').doc(uid).get();
    const userData = snap.exists ? snap.data() : null;
    const geminiVerified = userData?.geminiKeyVerified === true;

    const res = NextResponse.json({
      success: true,
      status: geminiVerified ? 'verified' : 'unverified',
    });

    // Set session cookie
    res.cookies.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: true, // 🔥 luôn TRUE khi SameSite=None
      sameSite: 'none', // 🔥 bắt buộc trong môi trường Firebase Studio
      maxAge: expiresIn / 1000,
      path: '/',
    });

    // Required headers for cookie-based CORS
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Cache-Control', 'no-store');

    return res;
  } catch (err: any) {
    console.error('SESSION ERROR:', err);

    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const response = NextResponse.json({ success: true, status: 'logged_out' });
    response.cookies.set({
      name: 'session',
      value: '',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error: any) {
     console.error('[Session API] Failed to delete session cookie:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete session.',
      },
      { status: 500 }
    );
  }
}
