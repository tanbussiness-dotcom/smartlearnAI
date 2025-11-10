'use server';
/**
 * @fileOverview Defines the Genkit flow for retrieving a list of all certificates for a user.
 *
 * This flow queries all of a user's topics and roadmaps to find entries
 * that have a valid certificate URL, compiling them into a single list.
 *
 * @exports getCertificateList - The main function to fetch the certificate list.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Input schema for the flow.
const GetCertificateListInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
});
export type GetCertificateListInput = z.infer<
  typeof GetCertificateListInputSchema
>;

const CertificateSchema = z.object({
  roadmapId: z.string(),
  topicId: z.string(),
  title: z.string(),
  certificateUrl: z.string().url(),
  createdAt: z.string(),
});

// Output schema for the flow.
const GetCertificateListOutputSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful.'),
  message: z.string().describe('A message detailing the result.'),
  certificates: z.array(CertificateSchema).describe('A list of certificates found for the user.'),
});
export type GetCertificateListOutput = z.infer<
  typeof GetCertificateListOutputSchema
>;

export const getCertificateList = ai.defineFlow(
  {
    name: 'getCertificateList',
    inputSchema: GetCertificateListInputSchema,
    outputSchema: GetCertificateListOutputSchema,
  },
  async (input) => {
    const { userId } = input;
    const result: z.infer<typeof CertificateSchema>[] = [];

    console.log(`🔍 Fetching certificates for user: ${userId}`);

    try {
      const topicsSnap = await db.collection(`users/${userId}/topics`).get();
      for (const topicDoc of topicsSnap.docs) {
        const topicId = topicDoc.id;
        const roadmapsSnap = await db
          .collection(`users/${userId}/topics/${topicId}/roadmaps`)
          .get();

        for (const roadmapDoc of roadmapsSnap.docs) {
          const data = roadmapDoc.data();
          // Check if the certificate object and its url property exist.
          if (data.certificate && data.certificate.url) {
            result.push({
              roadmapId: roadmapDoc.id,
              topicId: topicId,
              title: data.stepTitle || 'Untitled Roadmap', // Use stepTitle as per our structure
              certificateUrl: data.certificate.url,
              // Handle both Timestamp and string formats for createdAt
              createdAt: data.certificate.createdAt?.toDate
                ? data.certificate.createdAt.toDate().toISOString()
                : data.certificate.createdAt || new Date().toISOString(),
            });
          }
        }
      }

      console.log(`✅ Found ${result.length} certificates for ${userId}`);
      return {
        success: true,
        message: `Found ${result.length} certificates.`,
        certificates: result,
      };
    } catch (error: any) {
      console.error('❌ Error fetching certificates:', error);
      return {
        success: false,
        message: error.message,
        certificates: [],
      };
    }
  }
);
