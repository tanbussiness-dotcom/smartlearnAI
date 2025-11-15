
import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/firebase/admin';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });
  }

  try {
    const decodedToken = await authAdmin.verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;

    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();

    if (!userDoc.exists || !userDoc.data()?.geminiKeyVerified) {
      return NextResponse.json({ status: 'unverified' });
    }

    return NextResponse.json({ status: 'verified' });
  } catch (error) {
    // Session cookie is invalid or expired.
    return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });
  }
}
