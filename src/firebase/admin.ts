import * as admin from 'firebase-admin';

// Singleton instances
let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

/**
 * Initializes the Firebase Admin SDK if it hasn't been initialized yet.
 * This is a singleton pattern to avoid re-initializing the app.
 * It reads credentials from a Base64 encoded environment variable.
 * @returns An object containing the Firestore database instance, storage, and the admin namespace.
 */
export function initializeFirebaseAdmin() {
  if (admin.apps.length === 0) {
    try {
      const adminSdkConfig = process.env.FIREBASE_ADMIN_SDK_CONFIG_BASE64;
      if (!adminSdkConfig) {
        throw new Error('FIREBASE_ADMIN_SDK_CONFIG_BASE64 is not set in environment variables.');
      }

      // Decode the Base64 string to get the JSON string
      const serviceAccountJson = Buffer.from(adminSdkConfig, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
      });

      console.log('Firebase Admin SDK initialized successfully.');
    } catch (e: any) {
      console.error('Firebase Admin initialization error:', e.message);
      // Let subsequent calls fail if initialization fails.
    }
  }

  // These will throw if initializeApp failed, which is the intended behavior.
  if (!db) {
    db = admin.firestore();
  }
  if (!storage) {
    storage = admin.storage();
  }

  return { admin, db, storage };
}
