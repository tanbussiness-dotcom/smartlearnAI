'use server';
/**
 * @fileOverview Defines the server action for generating a course completion certificate.
 *
 * This function is now a stub. The logic has been migrated to the client-side
 * to remove the dependency on the Firebase Admin SDK.
 *
 * @exports generateCourseCertificate - The main function to generate a certificate.
 */

import { z } from 'zod';

// Input schema for the function.
const GenerateCourseCertificateInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  roadmapId: z.string().describe('The ID of the roadmap to certify.'),
});
export type GenerateCourseCertificateInput = z.infer<
  typeof GenerateCourseCertificateInputSchema
>;

// Output schema for the function.
const GenerateCourseCertificateOutputSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful.'),
  message: z.string().describe('A message detailing the result.'),
  certificateUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .describe('The public URL of the generated certificate PDF.'),
});
export type GenerateCourseCertificateOutput = z.infer<
  typeof GenerateCourseCertificateOutputSchema
>;

export async function generateCourseCertificate(input: GenerateCourseCertificateInput): Promise<GenerateCourseCertificateOutput> {
    console.warn("`generateCourseCertificate` is a stub and does not generate certificates. This logic should be handled client-side.");
    return {
        success: false,
        message: 'Certificate generation is not implemented on the server. This should be a client-side action.',
        certificateUrl: ''
    };
}
