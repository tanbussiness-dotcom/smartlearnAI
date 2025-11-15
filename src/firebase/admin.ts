
import admin from "firebase-admin";

let app;

// This check ensures that Firebase is only initialized once
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  // Verify that the private key is in the correct format
  if (!privateKey?.includes("-----BEGIN PRIVATE KEY-----")) {
    console.error("❌ Invalid FIREBASE_PRIVATE_KEY. Please check your environment variable for correct line breaks and escaping.");
    throw new Error("Invalid FIREBASE_PRIVATE_KEY format. Ensure it is a valid PEM key string.");
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  console.log("✅ Firebase Admin initialized successfully.");
} else {
  // If already initialized, reuse the existing app instance
  app = admin.app();
  console.log("⚡ Firebase Admin already initialized (reusing existing instance).");
}

export const authAdmin = admin.auth(app);
export const firestoreAdmin = admin.firestore(app);
