import { classifyByKeywords } from './classifier';
import {
  type ExtractedDocumentFields,
  extractStructuredFields,
} from './extraction';
import { parsePdfBuffer } from './parser';
import type { ClassifiedDocumentType, ParsedPdfResult } from './types';

export type { ExtractedDocumentFields } from './extraction';
export { extractBoxCount, isPlausibleCompanyName } from './extraction';
export {
  parseDealDateFromIso,
  parseTradeDocumentDate,
  pickArrivalDateDistinctFromDeparture,
  pickEarliestParsedDate,
  pickFirstParsedDate,
  pickLatestParsedDateAfter,
} from './trade-document-dates';

export type ClassificationResult = {
  type: ClassifiedDocumentType;
  score: number;
  matchedKeywords: string[];
};

export type ClassifiedPdf = {
  parsed: ParsedPdfResult;
  classification: ClassificationResult;
  extracted: ExtractedDocumentFields;
};

export async function classifyAndExtractPdfBuffer(
  buffer: Uint8Array,
  fileName?: string,
): Promise<ClassifiedPdf> {
  const parsed = await parsePdfBuffer(buffer, fileName);
  const classification = classifyByKeywords(parsed.text, undefined, {
    filePath: parsed.filePath,
  });
  return {
    parsed,
    classification,
    extracted: extractStructuredFields(parsed, classification.type),
  };
}
