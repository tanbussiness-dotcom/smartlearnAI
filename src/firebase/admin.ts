
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // This is for App Hosting environment which uses Application Default Credentials
    admin.initializeApp();
  } catch (e) {
    // For local development, it might fall back to GOOGLE_APPLICATION_CREDENTIALS
    // or other explicit configuration if available.
    console.warn('Automatic Firebase Admin initialization failed. This is expected in local dev without credentials. Error:', e);
    // If you need to run locally with admin SDK, ensure you have credentials set up.
    // e.g. via `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/key.json"`
  }
}

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
