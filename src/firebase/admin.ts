
import * as admin from 'firebase-admin';
import serviceAccount from '../../vertex-ai-admin.json';

// Define a type for the service account credentials for better type safety
interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

/**
 * Initializes the Firebase Admin SDK if it hasn't been initialized yet.
 * This is a singleton pattern to avoid re-initializing the app.
 * @returns An object containing the Firestore database instance and the admin namespace.
 */
export function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      const typedServiceAccount = serviceAccount as ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(typedServiceAccount),
        storageBucket: `${typedServiceAccount.project_id}.appspot.com`,
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (e) {
      console.error('Firebase Admin initialization error:', e);
      // This will cause subsequent calls to fail, which is the desired behavior
      // if initialization fails.
    }
  }
  
  if (!db) {
    db = admin.firestore();
  }
  if (!storage) {
    storage = admin.storage();
  }

  return { admin, db, storage };
}
