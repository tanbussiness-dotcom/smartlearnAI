import { NextResponse } from 'next/server';
import { authAdmin } from '@/firebase/admin';

export async function GET() {
  try {
    const envCheck = {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    };

    const initialized = !!authAdmin;
    let canSign = false;
    let signerError = null;
    let projectId = null;
    let clientEmail = null;
    let usingDefaultCreds = false;

    if (initialized) {
      try {
        // Try to sign a test token to confirm signer capability
        const token = await authAdmin.createCustomToken('debug-test');
        canSign = !!token;
      } catch (err: any) {
        signerError = err.message;
      }

      // Extract safe metadata about the initialized app
      try {
        const opts = (authAdmin as any)?.app?.options || {};
        projectId = opts.projectId || process.env.FIREBASE_PROJECT_ID || 'unknown';
        clientEmail = process.env.FIREBASE_CLIENT_EMAIL
          ? process.env.FIREBASE_CLIENT_EMAIL.replace(/(.{3}).+(@.+)/, '$1***$2')
          : 'unknown';
        usingDefaultCreds = !process.env.FIREBASE_PRIVATE_KEY;
      } catch {
        // Silent fail
      }
    }

    return NextResponse.json({
      success: true,
      initialized,
      canSign,
      signerError,
      projectId,
      clientEmail,
      usingDefaultCreds,
      envCheck,
      hint:
        canSign
          ? '✅ Firebase Admin has proper Service Account credentials and can sign session cookies.'
          : '⚠️ The Admin SDK is initialized but lacks signing permission. Check FIREBASE_PRIVATE_KEY or use a proper Service Account JSON.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Unexpected debug error',
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
