'use server';
export async function generateLesson(input: any) {
  console.log('[generateLesson:test] Entry — input:', JSON.stringify(input));
  // quick test response
  const testPayload = { success: true, data: { test: 'ok', timestamp: new Date().toISOString() } };
  console.log('[generateLesson:test] Returning testPayload');
  return testPayload;
}
