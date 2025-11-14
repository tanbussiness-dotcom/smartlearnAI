import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // This is for App Hosting environment
    admin.initializeApp();
  } catch (e) {
    if (process.env.NODE_ENV === "production") {
      console.warn('Automatic Firebase Admin initialization failed. Check service account credentials.');
    }
    // Fallback for local development if GOOGLE_APPLICATION_CREDENTIALS is set
    admin.initializeApp();
  }
}

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
