import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
