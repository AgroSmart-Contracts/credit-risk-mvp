import { classifyByKeywords } from './classifier.js';
import {
  type ExtractedDocumentFields,
  extractStructuredFields,
} from './extraction.js';
import { parsePdfBuffer } from './parser.js';
import type { ClassifiedDocumentType, ParsedPdfResult } from './types.js';

export type { ExtractedDocumentFields } from './extraction.js';
export { extractBoxCount, isPlausibleCompanyName } from './extraction.js';
export {
  parseDealDateFromIso,
  parseTradeDocumentDate,
  pickArrivalDateDistinctFromDeparture,
  pickEarliestParsedDate,
  pickFirstParsedDate,
  pickLatestParsedDateAfter,
} from './trade-document-dates.js';

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
