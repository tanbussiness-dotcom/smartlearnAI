import { NextResponse } from 'next/server';
import admin, { authAdmin } from '@/firebase/admin';

export async function GET() {
  try {
    const appsInitialized = !!admin.apps?.length;
    const projectId = admin?.app()?.options?.projectId || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || null;
    
    let canCreateToken = false;
    let createTokenError = null;
    try {
      const token = await authAdmin.createCustomToken('debug-test');
      if (token) canCreateToken = true;
    } catch (e: any) {
      createTokenError = e.message || String(e);
    }

    return NextResponse.json({
      success: true,
      appsInitialized,
      projectId,
      canCreateToken,
      createTokenError,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'debug failed' }, { status: 500 });
  }
}
