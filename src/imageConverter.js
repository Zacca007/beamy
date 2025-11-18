// webpToPdf.js
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

/**
 * urls: array di URL (stringhe) delle immagini WEBP
 * ritorna: Buffer del PDF
 */
async function webpToPdf(urls) {
    const pdfDoc = await PDFDocument.create();

    for (const url of urls) {
        // Scarico l'immagine dal web usando fetch Nativo di Node
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Impossibile scaricare ${url}: ${res.status}`);
        }

        const webpBuffer = Buffer.from(await res.arrayBuffer());

        // Converto WEBP -> PNG
        const pngBuffer = await sharp(webpBuffer).png().toBuffer();

        // Inserisco l'immagine nel PDF
        const img = await pdfDoc.embedPng(pngBuffer);
        const { width, height } = img;

        const page = pdfDoc.addPage([width, height]);
        page.drawImage(img, {
            x: 0,
            y: 0,
            width,
            height,
        });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

module.exports = { webpToPdf };
