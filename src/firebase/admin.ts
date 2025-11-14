
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // This is for App Hosting environment which uses Application Default Credentials
    admin.initializeApp();
    console.log("[Firebase Admin] Initialized successfully using Application Default Credentials.");
  } catch (e) {
    console.warn('Automatic Firebase Admin initialization failed. This is expected in local dev without credentials. Attempting manual initialization... Error:', e);
    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }
        
        if(!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            throw new Error("Missing Firebase Admin credentials in environment variables.");
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("[Firebase Admin] Initialized successfully using environment variables.");
    } catch (manualError) {
        console.error("[Firebase Admin] All initialization methods failed:", manualError);
    }
  }
}

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
