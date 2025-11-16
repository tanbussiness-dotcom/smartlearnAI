import * as admin from 'firebase-admin';

// Check if already initialized
if (!admin.apps.length) {
  try {
    // First, try to use service account JSON if provided
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    if (serviceAccountJson) {
      console.log('[Admin SDK] Initializing with FIREBASE_SERVICE_ACCOUNT_JSON...');
      try {
        const serviceAccount = JSON.parse(
          Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
        );
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
        });
        
        console.log('[Admin SDK] Initialized successfully with service account');
      } catch (parseError) {
        console.error('[Admin SDK] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseError);
        throw parseError;
      }
    } else {
      // Fallback: Try application default credentials
      console.log('[Admin SDK] No FIREBASE_SERVICE_ACCOUNT_JSON found, trying application default credentials...');
      
      // Check if we're in Google Cloud environment
      const projectId = process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID;
      
      if (projectId) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: projectId,
        });
        console.log('[Admin SDK] Initialized with application default credentials for project:', projectId);
      } else {
        throw new Error('No Firebase project configuration found. Set FIREBASE_SERVICE_ACCOUNT_JSON or GCP_PROJECT environment variable.');
      }
    }
  } catch (error) {
    console.error('[Admin SDK] FATAL: Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
} else {
  console.log('[Admin SDK] Already initialized');
}

// Test the admin SDK
try {
  const app = admin.app();
  console.log('[Admin SDK] Active app name:', app.name);
  console.log('[Admin SDK] Project ID:', app.options.projectId || 'unknown');
} catch (error) {
  console.error('[Admin SDK] Failed to get app info:', error);
}

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
export default admin;
