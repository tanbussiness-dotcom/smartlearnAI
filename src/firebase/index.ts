'use client';

// This file serves as the main entry point for all Firebase-related modules.

// Re-export the initialized services for easy access
export { firebaseApp, auth, firestore } from './config';

// Re-export providers and hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
