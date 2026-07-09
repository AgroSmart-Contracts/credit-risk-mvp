import type { ClassifiedPdf } from './pdf-trade-classifier/index.js';
import { mapExtractedFieldsToDealSuggestions } from './map-extracted-to-deal.js';
import {
  estimateDocCoveragePct,
  listFilledDealFieldKeys,
  mergeDealFieldSuggestions,
} from './merge-suggestions.js';
import type {
  AnalyzeDocumentsResult,
  AnalyzedDocument,
  DealFieldSuggestions,
} from '../src/lib/document-analysis/types.js';

export type UploadedPdfFile = {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
};

function isPdf(file: UploadedPdfFile): boolean {
  const ext = file.fileName.split('.').pop()?.toLowerCase();
  return (
    ext === 'pdf' ||
    file.mimeType === 'application/pdf' ||
    file.mimeType === 'application/octet-stream'
  );
}

function buildExtractionHint(result: ClassifiedPdf): string {
  const { extracted, classification } = result;
  const hints: string[] = [classification.type];

  if (extracted.contract?.productName) {
    hints.push(extracted.contract.productName.trim());
  }
  if (extracted.contract?.totalValueUSD != null) {
    hints.push(
      `USD ${extracted.contract.totalValueUSD.toLocaleString('en-US')}`,
    );
  } else if (extracted.invoice?.invoiceTotal != null) {
    hints.push(
      `USD ${extracted.invoice.invoiceTotal.toLocaleString('en-US')}`,
    );
  }

  if (extracted.contract?.incoterm) {
    hints.push(extracted.contract.incoterm);
  }

  if (extracted.common.requiresOcr) {
    hints.push('OCR may be required');
  }

  return hints.filter(Boolean).join(' · ');
}

function mapDocumentType(detectedType: string, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('coface')) return 'credit_insurance';
  if (
    detectedType === 'Purchase Order or Contract' ||
    lower.includes('orden') ||
    lower.includes('acuerdo') ||
    lower.includes('contrato')
  ) {
    return lower.includes('orden') ? 'purchase_order' : 'contract';
  }
  if (detectedType === 'Commercial Invoice') return 'sales_order';
  return 'contract';
}

export async function analyzeUploadedPdfs(
  files: UploadedPdfFile[],
): Promise<AnalyzeDocumentsResult> {
  if (!files.length) {
    throw new Error('At least one file is required');
  }

  const { classifyAndExtractPdfBuffer } = await import('./pdf-trade-classifier/index.js');

  const sorted = [...files].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, { sensitivity: 'base' }),
  );

  const documents: AnalyzedDocument[] = [];
  const suggestionParts: DealFieldSuggestions[] = [];

  for (const file of sorted) {
    if (!isPdf(file)) {
      documents.push({
        fileName: file.fileName,
        detectedType: 'Unsupported',
        extractionHint: 'Only PDF parsing is supported in this demo',
      });
      continue;
    }

    if (file.buffer.length > 30 * 1024 * 1024) {
      documents.push({
        fileName: file.fileName,
        detectedType: 'Too large',
        extractionHint: 'File exceeds 30 MB limit',
      });
      continue;
    }

    try {
      const result = await classifyAndExtractPdfBuffer(
        new Uint8Array(file.buffer),
        file.fileName,
      );
      const suggestions = mapExtractedFieldsToDealSuggestions(result.extracted);
      suggestionParts.push(suggestions);

      documents.push({
        fileName: file.fileName,
        detectedType: mapDocumentType(result.classification.type, file.fileName),
        extractionHint: buildExtractionHint(result),
        requiresOcr: result.extracted.common.requiresOcr,
        extractionQuality: result.extracted.common.extractionQuality,
      });
    } catch {
      documents.push({
        fileName: file.fileName,
        detectedType: 'Parse error',
        extractionHint: 'Could not extract text from PDF',
      });
    }
  }

  const suggestions = mergeDealFieldSuggestions(suggestionParts);
  const filledFields = listFilledDealFieldKeys(suggestions);
  const docCoveragePct = estimateDocCoveragePct(suggestions);

  return {
    documents,
    suggestions,
    filledFields,
    docCoveragePct,
  };
}
