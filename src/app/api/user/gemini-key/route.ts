
import { firestoreAdmin, authAdmin } from '@/firebase/admin';
import { encrypt } from '@/lib/crypto';
import { cookies } from 'next/headers';

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    try {
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await req.json();
  if (!apiKey || typeof apiKey !== 'string') {
    return Response.json({ error: "Missing or invalid API key" }, { status: 400 });
  }

  try {
    // Validate the API key by trying to list models
    const validationUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const validationResponse = await fetch(validationUrl);

    if (!validationResponse.ok) {
        return Response.json({ error: "Invalid Gemini API key" }, { status: 400 });
    }

    const encryptedKey = encrypt(apiKey);

    await firestoreAdmin.collection("users").doc(userId).set({
      geminiKey: encryptedKey,
      geminiKeyLastUpdated: new Date().toISOString(),
    }, { merge: true });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error saving API key:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const doc = await firestoreAdmin.collection("users").doc(userId).get();

    if (!doc.exists) {
        return Response.json({ hasKey: false, lastUpdated: null });
    }
    
    const data = doc.data();

    return Response.json({
      hasKey: !!data?.geminiKey,
      lastUpdated: data?.geminiKeyLastUpdated || null,
    });
  } catch (error) {
    console.error("Error fetching API key status:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
