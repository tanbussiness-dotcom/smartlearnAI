'use client';

import { firebaseConfig as firebaseConfigData } from './firebaseConfig';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// This function safely initializes Firebase, ensuring it's only done once.
function initializeFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  
  try {
    // This is for App Hosting environment
    return initializeApp();
  } catch (e) {
    if (process.env.NODE_ENV === "production") {
      console.warn('Automatic Firebase initialization failed. Falling back to local config.', e);
    }
    return initializeApp(firebaseConfigData);
  }
}

const firebaseApp = initializeFirebaseApp();
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

export { firebaseApp, auth, firestore };
