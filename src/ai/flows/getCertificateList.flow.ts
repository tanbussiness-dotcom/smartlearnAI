'use server';
/**
 * @fileOverview Defines a server action stub for retrieving a certificate list.
 *
 * This flow is now a stub. The logic should be implemented on the client-side
 * using Firestore queries to avoid server-side Admin SDK usage.
 *
 * @exports getCertificateList - The main function to fetch the certificate list.
 */

import { z } from 'zod';

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

export async function getCertificateList(input: GetCertificateListInput): Promise<GetCertificateListOutput> {
  return {
    success: false,
    message: 'Certificate fetching is not implemented on the server. This should be a client-side action.',
    certificates: [],
  };
}
