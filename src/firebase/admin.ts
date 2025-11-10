import * as admin from 'firebase-admin';

// Define a type for the service account credentials for better type safety
interface ServiceAccount {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

/**
 * Initializes the Firebase Admin SDK if it hasn't been initialized yet.
 * This is a singleton pattern to avoid re-initializing the app.
 * It reads credentials from environment variables.
 * @returns An object containing the Firestore database instance and the admin namespace.
 */
export function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      const privateKey = process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (
        !process.env.FB_PROJECT_ID ||
        !privateKey ||
        !process.env.FB_CLIENT_EMAIL
      ) {
        throw new Error(
          'Missing Firebase Admin credentials in environment variables.'
        );
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FB_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FB_CLIENT_EMAIL,
        }),
        storageBucket: `${process.env.FB_PROJECT_ID}.appspot.com`,
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (e) {
      console.error('Firebase Admin initialization error:', e);
      // This will cause subsequent calls to fail, which is the desired behavior
      // if initialization fails.
    }
  }

  // These will throw an error if initializeApp failed, which is intended.
  if (!db) {
    db = admin.firestore();
  }
  if (!storage) {
    storage = admin.storage();
  }

  return { admin, db, storage };
}
