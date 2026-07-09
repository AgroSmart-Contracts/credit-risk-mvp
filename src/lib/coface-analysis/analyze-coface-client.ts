import type { CofaceExtractionResult } from './types';

const ANALYZE_URL = '/api/analyze-coface';

function normalizePdfMime(file: File): File {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const shouldNormalizePdfMime =
    extension === 'pdf' &&
    (!file.type || file.type === 'application/octet-stream');
  return shouldNormalizePdfMime
    ? new File([file], file.name, { type: 'application/pdf' })
    : file;
}

export async function analyzeCofaceDocument(
  file: File,
): Promise<CofaceExtractionResult> {
  const formData = new FormData();
  const uploadFile = normalizePdfMime(file);
  formData.append('file', uploadFile, uploadFile.name);

  const response = await fetch(ANALYZE_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message ?? 'Coface document analysis failed');
  }

  return (await response.json()) as CofaceExtractionResult;
}

export function computeCoveragePct(
  coverageAmountUSD: number,
  dealValueUSD: number,
): number | null {
  if (!Number.isFinite(dealValueUSD) || dealValueUSD <= 0) return null;
  return Math.min(100, Math.round((coverageAmountUSD / dealValueUSD) * 100));
}
