import { NextResponse } from 'next/server';
import { authAdmin } from '@/firebase/admin';

export async function GET() {
  try {
    const envCheck = {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    };

    const adminInitialized = !!authAdmin;
    let canSign = false;
    let testToken = null;
    let signerError = null;

    if (adminInitialized) {
        try {
        testToken = await authAdmin.createCustomToken('test-debug');
        canSign = !!testToken;
        } catch (err: any) {
        signerError = err.message;
        }
    }


    const options = adminInitialized ? authAdmin.app.options : {};

    return NextResponse.json({
      success: true,
      initialized: adminInitialized,
      projectId: options.projectId || process.env.FIREBASE_PROJECT_ID || null,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        ? process.env.FIREBASE_CLIENT_EMAIL.replace(/(.{3}).+(@.+)/, '$1***$2')
        : null,
      canSign,
      signerError,
      timestamp: new Date().toISOString(),
      envCheck,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to inspect Firebase Admin SDK',
      stack: error.stack || null,
      timestamp: new Date().toISOString(),
    });
  }
}
