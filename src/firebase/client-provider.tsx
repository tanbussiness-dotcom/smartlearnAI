'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseApp, auth, firestore } from '@/firebase/config';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// This client-side provider ensures that the Firebase services are passed
// down to the context provider. The initialization logic is handled in `config.ts`.
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
