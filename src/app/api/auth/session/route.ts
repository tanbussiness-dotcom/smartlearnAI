
import { NextResponse, type NextRequest } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const idToken = body?.idToken;

    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Missing idToken' }, { status: 400 });
    }

    if (!authAdmin) {
       console.error('[Session API] Firebase Admin SDK not initialized properly.');
       return NextResponse.json(
        { success: false, error: 'Firebase Admin SDK not initialized properly. Check server logs.' },
        { status: 500 }
      );
    }

    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days
    console.log('[Session API] Received idToken, creating session cookie...');

    const decodedToken = await authAdmin.verifyIdToken(idToken, true);
    if (!decodedToken?.uid) {
       return NextResponse.json({ success: false, error: 'Failed to decode or verify ID token.' }, { status: 401 });
    }

    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    const userId = decodedToken.uid;
    
    console.log(`[Session API] Session cookie created for user: ${userId}`);

    // Check Firestore for Gemini key verification
    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();
    const isVerified = userDoc.exists && userDoc.data()?.geminiKeyVerified === true;

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
    console.error('[Session API] Failed to create session cookie:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create session.',
        code: error.code || 'unknown_error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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
