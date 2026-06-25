/* js/pdf-helper.js */

/**
 * Extracts all text from a PDF file represented as an ArrayBuffer.
 * Uses the global pdfjsLib library loaded via CDN.
 * 
 * @param {ArrayBuffer} arrayBuffer The binary data of the PDF.
 * @param {Function} onProgress Optional callback for page-by-page progress (e.g. (page, total) => {})
 * @returns {Promise<string>} The extracted text content.
 */
export async function extractTextFromPdf(arrayBuffer, onProgress) {
  try {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
    }

    // Load document
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let extractedText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Merge strings with a spaces, respect layout somewhat
      let lastY = null;
      let pageText = '';
      
      for (const item of textContent.items) {
        // Simple heuristic: if Y coordinate changes significantly, add a newline
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
          pageText += '\n';
        }
        pageText += item.str + ' ';
        lastY = item.transform[5];
      }

      extractedText += `[Sayfa ${pageNum}]\n${pageText}\n\n`;

      if (onProgress && typeof onProgress === 'function') {
        onProgress(pageNum, numPages);
      }
    }

    return extractedText.trim();
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw error;
  }
}
