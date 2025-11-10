
'use client';

import { firebaseConfig as firebaseConfigData } from './firebaseConfig';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

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

// Enable offline persistence
enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence failed: multiple tabs open.');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence.
        console.warn('Firestore persistence not available in this browser.');
    } else {
        console.error("Firestore persistence error:", err);
    }
});


export { firebaseApp, auth, firestore };
