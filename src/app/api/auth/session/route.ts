
import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const { idToken } = await req.json();

  if (!idToken) {
    return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
  }

  // Set session expiration to 7 days.
  const expiresIn = 60 * 60 * 24 * 7 * 1000;

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken, true);
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
    const userId = decodedToken.uid;

    const options = {
      name: 'session',
      value: sessionCookie,
      maxAge: expiresIn / 1000, // maxAge is in seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };

    // Set cookie
    cookies().set(options);

    // Check if user has a verified Gemini key
    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();
    const isVerified = userDoc.exists && userDoc.data()?.geminiKeyVerified === true;
    
    return NextResponse.json({ status: isVerified ? 'verified' : 'unverified' });

  } catch (error) {
    console.error('Error creating session cookie:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 });
  }
}

export async function DELETE() {
  cookies().delete('session');
  return NextResponse.json({ status: 'success' });
}
