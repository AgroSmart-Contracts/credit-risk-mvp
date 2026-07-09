import type { AnalyzeDocumentsResult } from './types';

const ANALYZE_URL = '/api/analyze-documents';

function normalizePdfMime(file: File): File {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const shouldNormalizePdfMime =
    extension === 'pdf' &&
    (!file.type || file.type === 'application/octet-stream');
  return shouldNormalizePdfMime
    ? new File([file], file.name, { type: 'application/pdf' })
    : file;
}

export async function analyzeDealDocuments(
  files: File[],
): Promise<AnalyzeDocumentsResult> {
  const pdfFiles = files.filter((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'pdf' || file.type === 'application/pdf';
  });

  if (!pdfFiles.length) {
    return {
      documents: files.map((file) => ({
        fileName: file.name,
        detectedType: 'Unsupported',
        extractionHint: 'Upload PDF trade documents for auto-fill',
      })),
      suggestions: {},
      filledFields: [],
      docCoveragePct: 0,
    };
  }

  const formData = new FormData();
  for (const file of pdfFiles) {
    const uploadFile = normalizePdfMime(file);
    formData.append('files', uploadFile, uploadFile.name);
  }

  const response = await fetch(ANALYZE_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message ?? 'Document analysis failed');
  }

  return (await response.json()) as AnalyzeDocumentsResult;
}
