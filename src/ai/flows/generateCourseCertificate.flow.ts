
'use server';
/**
 * @fileOverview Defines the Genkit flow for generating a course completion certificate.
 *
 * This flow checks a user's roadmap progress, generates a PDF certificate
 * with optional AI-generated text, uploads it to Firebase Storage, and saves
 * the public URL back to Firestore.
 *
 * @exports generateCourseCertificate - The main function to generate a certificate.
 */

import { ai } from '../../../genkit.config';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fetch from 'node-fetch';

// Initialize Firebase Admin SDK if it hasn't been already.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    console.error('Firebase Admin initialization error:', e);
    // In a serverless environment, you might not need to pass credentials
    // if the runtime is already authenticated.
    if (!admin.apps.length) {
       try {
        admin.initializeApp();
       } catch (e2) {
         console.error('Fallback Firebase Admin initialization error:', e2);
       }
    }
  }
}
const db = admin.firestore();
const storage = admin.storage();

// Configuration
const BUCKET_NAME = process.env.STORAGE_BUCKET || 'smartlearn-ai.appspot.com';
const CERT_FOLDER = 'certificates';

// Input schema for the flow.
const GenerateCourseCertificateInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  topicId: z.string().describe('The ID of the parent topic.'),
  roadmapId: z.string().describe('The ID of the roadmap to certify.'),
  forceGenerate: z
    .boolean()
    .default(false)
    .describe('Bypass the progress check and generate the certificate anyway.'),
  useAIText: z
    .boolean()
    .default(false)
    .describe('Use AI to generate a congratulatory message.'),
});
export type GenerateCourseCertificateInput = z.infer<
  typeof GenerateCourseCertificateInputSchema
>;

// Output schema for the flow.
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
  return generateCourseCertificateFlow(input);
}


const generateCourseCertificateFlow = ai.defineFlow(
  {
    name: 'generateCourseCertificateFlow',
    inputSchema: GenerateCourseCertificateInputSchema,
    outputSchema: GenerateCourseCertificateOutputSchema,
  },
  async (input) => {
    const { userId, topicId, roadmapId, forceGenerate, useAIText } = input;

    try {
      if (!BUCKET_NAME) {
        throw new Error('Missing STORAGE_BUCKET environment variable.');
      }

      const roadmapPath = `users/${userId}/topics/${topicId}/roadmaps/${roadmapId}`;
      const roadmapRef = db.doc(roadmapPath);
      const roadmapSnap = await roadmapRef.get();
      if (!roadmapSnap.exists) {
        throw new Error('Roadmap not found.');
      }

      const roadmapData = roadmapSnap.data();
      const progress = roadmapData?.progressPercent ?? 0;

      if (!forceGenerate && progress < 95) {
        return {
          success: false,
          message: `Progress is ${progress}%, which is less than the required 95%. Set forceGenerate=true to bypass.`,
          certificateUrl: '',
        };
      }

      // Fetch user and course details
      const userSnap = await db.doc(`users/${userId}`).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const userName = userData?.displayName || userData?.name || 'Valued Learner';
      const courseTitle = roadmapData?.stepTitle || `Roadmap ${roadmapId}`;

      let certificateBody = `This certifies that ${userName} has successfully completed the learning roadmap titled "${courseTitle}". Congratulations on this monumental achievement!`;

      if (useAIText) {
        try {
          const aiPrompt = ai.definePrompt({
            name: 'certificateTextPrompt',
            prompt: `Write a short, inspiring, two-sentence congratulatory message for a certificate. The student, ${userName}, has just completed the course "${courseTitle}". The tone should be formal and celebratory.`,
          });
          const { text } = await ai.generate({ prompt: aiPrompt.prompt });
          if(text) {
            certificateBody = text;
          }
        } catch (e) {
          console.warn('AI text generation failed, falling back to default text.', e);
        }
      }

      // Create PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawRectangle({
        x: 30, y: 30, width: width - 60, height: height - 60,
        borderColor: rgb(0.1, 0.2, 0.5), borderWidth: 2,
      });
      page.drawText('CERTIFICATE OF COMPLETION', {
        x: 190, y: height - 100, size: 32, font: boldFont, color: rgb(0.1, 0.2, 0.5),
      });
      page.drawText('This certificate is proudly presented to', {
        x: 60, y: height - 150, size: 14, font, color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(userName, {
        x: 60, y: height - 190, size: 28, font: boldFont,
      });
       const wrap = (text: string, maxChars = 90) => {
        const words = text.split(/\s+/);
        const lines = [];
        let current = "";
        for (const word of words) {
          if ((current + " " + word).trim().length > maxChars) {
            lines.push(current.trim());
            current = word;
          } else current += " " + word;
        }
        if (current.trim()) lines.push(current.trim());
        return lines;
      };
      const lines = wrap(certificateBody, 90);
      let y = height - 240;
      for (const line of lines) {
        page.drawText(line, { x: 60, y, size: 14, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 22;
      }

      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      page.drawText(`Course: ${courseTitle}`, { x: 60, y: 80, size: 12, font });
      page.drawText(`Date Issued: ${dateStr}`, { x: 60, y: 60, size: 12, font });

      if (process.env.LOGO_URL) {
        try {
          const res = await fetch(process.env.LOGO_URL);
          const logoBytes = await res.arrayBuffer();
          const logoImage = await pdfDoc.embedPng(logoBytes);
          const logoDims = logoImage.scale(0.3);
          page.drawImage(logoImage, {
            x: width - logoDims.width - 60,
            y: 60,
            width: logoDims.width,
            height: logoDims.height,
          });
        } catch (e) {
          console.warn("Logo load failed, skipping.", e);
        }
      }

      const pdfBytes = await pdfDoc.save();

      // Upload to Firebase Storage
      const bucket = storage.bucket(BUCKET_NAME);
      const filePath = `${CERT_FOLDER}/${userId}/${roadmapId}-certificate.pdf`;
      const file = bucket.file(filePath);
      await file.save(Buffer.from(pdfBytes), { metadata: { contentType: 'application/pdf' } });

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491', // A far-future date
      });

      // Save URL to Firestore
      await roadmapRef.set({
        certificate: {
          url: url,
          path: filePath,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true });

      console.info(`✅ Certificate created for ${userName}: ${url}`);
      return { success: true, message: 'Certificate generated successfully.', certificateUrl: url };
    } catch (error: any) {
      console.error('❌ Certificate generation failed:', error);
      return { success: false, message: error.message, certificateUrl: '' };
    }
  }
);
