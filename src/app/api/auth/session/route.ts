
import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Missing idToken' }, { status: 400 });
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    console.log('[Session API] Received idToken, creating session cookie...');

    // Verify the token first
    const decodedToken = await authAdmin.verifyIdToken(idToken, true);
    if (!decodedToken?.uid) throw new Error('Failed to decode ID token.');

    // Create session cookie
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    const userId = decodedToken.uid;

    // Save secure cookie
    cookies().set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    console.log(`[Session API] Session cookie set for user: ${userId}`);

    // Check Firestore for Gemini key verification
    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();
    const isVerified = userDoc.exists && userDoc.data()?.geminiKeyVerified === true;

    return NextResponse.json({
      success: true,
      status: isVerified ? 'verified' : 'unverified',
      uid: userId,
    });
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
  cookies().delete('session');
  return NextResponse.json({ success: true, status: 'logged_out' });
}
