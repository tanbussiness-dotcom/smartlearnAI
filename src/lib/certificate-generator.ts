import { PlaceHolderImages } from '@/lib/placeholder-images';

async function fetchImage(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

export async function generateCertificate(userName: string, topicTitle: string) {
    // Dynamically import pdf-lib
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]); // A4 landscape

    const { width, height } = page.getSize();

    // Load fonts
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Load images
    const logoUrl = PlaceHolderImages.find(img => img.id === 'certificateLogo')?.imageUrl;
    const signatureUrl = PlaceHolderImages.find(img => img.id === 'certificateSignature')?.imageUrl;

    if (!logoUrl || !signatureUrl) {
        throw new Error("Certificate assets not found.");
    }
    
    const logoImageBytes = await fetchImage(logoUrl);
    const signatureImageBytes = await fetchImage(signatureUrl);
    
    const logoImage = await pdfDoc.embedPng(logoImageBytes);
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    // Draw border
    page.drawRectangle({
        x: 20,
        y: 20,
        width: width - 40,
        height: height - 40,
        borderColor: rgb(0.1, 0.53, 0.44), // #198770
        borderWidth: 2,
    });
    
    // Draw Logo
    const logoDims = logoImage.scale(0.15);
    page.drawImage(logoImage, {
        x: width / 2 - logoDims.width / 2,
        y: height - logoDims.height - 40,
        width: logoDims.width,
        height: logoDims.height,
    });

    // Draw text
    const titleText = 'CHỨNG NHẬN HOÀN THÀNH';
    page.drawText(titleText, {
        x: width / 2 - helveticaBoldFont.widthOfTextAtSize(titleText, 30) / 2,
        y: height - 150,
        font: helveticaBoldFont,
        size: 30,
        color: rgb(0.1, 0.3, 0.25),
    });

    const presentedToText = 'TRÂN TRỌNG TRAO TẶNG';
    page.drawText(presentedToText, {
        x: width / 2 - helveticaFont.widthOfTextAtSize(presentedToText, 14) / 2,
        y: height - 190,
        font: helveticaFont,
        size: 14,
        color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(userName.toUpperCase(), {
        x: width / 2 - helveticaBoldFont.widthOfTextAtSize(userName.toUpperCase(), 36) / 2,
        y: height - 250,
        font: helveticaBoldFont,
        size: 36,
        color: rgb(0, 0, 0),
    });

    const forCompletingText = `Vì đã hoàn thành xuất sắc lộ trình học:`;
    page.drawText(forCompletingText, {
        x: width / 2 - helveticaFont.widthOfTextAtSize(forCompletingText, 14) / 2,
        y: height - 290,
        font: helveticaFont,
        size: 14,
        color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`"${topicTitle}"`, {
        x: width / 2 - helveticaBoldFont.widthOfTextAtSize(`"${topicTitle}"`, 22) / 2,
        y: height - 330,
        font: helveticaBoldFont,
        size: 22,
        color: rgb(0.1, 0.53, 0.44),
    });

    // Draw Signature and Date
    const signatureDims = signatureImage.scale(0.3);
    const signatureX = width / 2 - signatureDims.width / 2;
    const signatureY = 120;

    page.drawImage(signatureImage, {
        x: signatureX,
        y: signatureY,
        width: signatureDims.width,
        height: signatureDims.height,
    });
    
    page.drawLine({
        start: { x: signatureX - 20, y: signatureY - 5 },
        end: { x: signatureX + signatureDims.width + 20, y: signatureY - 5 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
    });

    const instructorText = 'Giảng viên SmartLearn AI';
    page.drawText(instructorText, {
        x: width / 2 - helveticaFont.widthOfTextAtSize(instructorText, 12) / 2,
        y: signatureY - 20,
        font: helveticaFont,
        size: 12,
        color: rgb(0.5, 0.5, 0.5),
    });

    const date = new Date().toLocaleDateString('vi-VN');
    const dateText = `Cấp ngày: ${date}`;
    page.drawText(dateText, {
        x: width / 2 - helveticaFont.widthOfTextAtSize(dateText, 12) / 2,
        y: 70,
        font: helveticaFont,
        size: 12,
        color: rgb(0.5, 0.5, 0.5),
    });


    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // Trigger the download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Chung_chi_${topicTitle.replace(/ /g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
