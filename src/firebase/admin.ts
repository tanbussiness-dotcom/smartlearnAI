import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // Prefer explicit service account JSON if provided (recommended for production)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
        const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
        );
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } catch (e) {
        console.warn("[Admin SDK] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Falling back...", e);
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }
  } else {
    // Fallback: application default (works if GOOGLE_APPLICATION_CREDENTIALS env var set)
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
export default admin;
