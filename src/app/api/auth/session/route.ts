
import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Missing idToken' }, { status: 400 });
    }

    if (!authAdmin) {
      throw new Error('Firebase Admin SDK not initialized properly');
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    console.log('[Session API] Received idToken, creating session cookie...');

    const decodedToken = await authAdmin.verifyIdToken(idToken, true);
    if (!decodedToken?.uid) throw new Error('Failed to decode ID token.');

    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    const userId = decodedToken.uid;
    
    console.log(`[Session API] Session cookie created for user: ${userId}`);

    // Check Firestore for Gemini key verification
    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();
    const isVerified = userDoc.exists && userDoc.data()?.geminiKeyVerified === true;

    // Build response manually to attach the cookie
    const response = NextResponse.json({
      success: true,
      status: isVerified ? 'verified' : 'unverified',
      uid: userId,
    });

    response.cookies.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn / 1000,
      path: '/',
      sameSite: 'lax',
    });
    
    console.log('[Session API] Cookie attached to response.');
    return response;

  } catch (error: any) {
    console.error('[Session API] Failed to create session cookie:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create session',
        code: error.code || 'unknown',
      },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, status: 'logged_out' });
  // Instruct the browser to delete the cookie
  response.cookies.set({
    name: 'session',
    value: '',
    path: '/',
    maxAge: 0,
  });
  return response;
}
