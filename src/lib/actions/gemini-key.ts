'use server';

import { getAuth } from 'firebase-admin/auth';
import { firestoreAdmin, authAdmin } from '@/firebase/admin';
import { encrypt } from '@/lib/crypto';
import { headers } from 'next/headers';

type ActionResult = {
  success: boolean;
  message?: string;
};

async function getUserIdFromToken(): Promise<string | null> {
  const authHeader = headers().get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    try {
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (error) {
      console.error('Error verifying Firebase ID token in Server Action:', error);
      return null;
    }
  }
  return null;
}


export async function saveGeminiKey(apiKey: string): Promise<ActionResult> {
  console.log('[Gemini Key Validation] Starting...');

  const userId = await getUserIdFromToken();
  if (!userId) {
    return { success: false, message: 'Unauthorized. User token is missing or invalid.' };
  }

  if (!apiKey || typeof apiKey !== 'string') {
    return { success: false, message: 'Missing or invalid API key provided.' };
  }

  try {
    // 1. Validate the API key
    const validationUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const validationResponse = await fetch(validationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Connection test from SmartLearn AI.' }] }],
      }),
    });

    if (!validationResponse.ok) {
        console.warn(`[Gemini Key Validation] Failed with status: ${validationResponse.status}`);
        return { success: false, message: 'Invalid Gemini Key. The test call failed.' };
    }

    const validationData = await validationResponse.json();
    if (!validationData.candidates || !Array.isArray(validationData.candidates)) {
        console.warn('[Gemini Key Validation] Invalid response structure. Missing "candidates".');
        return { success: false, message: 'Invalid Gemini Key. The response was not in the expected format.' };
    }

    console.log('[Gemini Key Validation] Key is valid.');

    // 2. Encrypt and save the key
    const encryptedKey = encrypt(apiKey);
    const userDocRef = firestoreAdmin.collection('users').doc(userId);
    
    await userDocRef.set({
      geminiKey: encryptedKey,
      geminiKeyVerified: true,
      geminiKeyLastUpdated: new Date().toISOString(),
    }, { merge: true });

    console.log(`[Gemini Key Validation] Key saved successfully for user: ${userId}`);
    return { success: true };

  } catch (error: any) {
    console.error('[Gemini Key Validation] An unexpected error occurred:', error);
    return { success: false, message: error.message || 'An unknown error occurred during key validation.' };
  }
}
