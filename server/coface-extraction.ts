import { createRequire } from 'node:module';

import type { CofaceExtractionResult } from '../src/lib/coface-analysis/types.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (
  data: Buffer,
) => Promise<{ text: string }>;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[\s\u00A0]/g, '').replace(/,/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** MVP: sample deals treat EUR limits as USD-equivalent for scoring */
function toCoverageAmountUSD(amount: number, currency: string): number {
  const code = currency.toUpperCase();
  if (code === 'USD' || code === 'US$') return Math.round(amount);
  if (code === 'EUR') return Math.round(amount);
  return Math.round(amount);
}

export async function extractCofaceFromPdfBuffer(
  buffer: Buffer,
): Promise<CofaceExtractionResult> {
  const parsed = await pdfParse(buffer);
  const text = normalizeText(parsed.text);

  if (text.length < 40) {
    throw new Error('Could not extract readable text from Coface PDF');
  }

  const guaranteedMatch =
    text.match(
      /Guaranteed Amount:\s*([A-Z]{3})\s*([0-9][0-9.,\s]+)/i,
    ) ??
    text.match(/You requested:\s*([A-Z]{3})\s*([0-9][0-9.,\s]+)/i);

  if (!guaranteedMatch) {
    throw new Error(
      'No guaranteed credit limit found — expected a Coface limit notification PDF',
    );
  }

  const currency = guaranteedMatch[1].toUpperCase();
  const amount = parseMoney(guaranteedMatch[2]);
  if (amount == null) {
    throw new Error('Could not parse guaranteed amount from Coface document');
  }

  const debtorName =
    text
      .match(/Debtor:\s*([A-Z0-9][A-Z0-9\s.&-]{4,60}?)(?:\s+CARRERA|\s+NIT|\s+Easy)/i)?.[1]
      ?.trim() ?? undefined;

  const decisionDate =
    text.match(/Decision date:\s*([0-3]?\d\/[01]?\d\/\d{4})/i)?.[1] ??
    text.match(/Date:\s*([0-3]?\d\/[01]?\d\/\d{4})/i)?.[1];

  const notificationNumber = text.match(
    /Notification number:\s*([0-9]+)/i,
  )?.[1];

  const coverageAmountUSD = toCoverageAmountUSD(amount, currency);
  const hintParts = [
    `${currency} ${amount.toLocaleString('en-US')} guaranteed`,
    debtorName,
    decisionDate ? `decision ${decisionDate}` : undefined,
  ].filter(Boolean);

  return {
    guaranteedAmount: amount,
    currency,
    coverageAmountUSD,
    debtorName,
    decisionDate,
    notificationNumber,
    extractionHint: hintParts.join(' · '),
  };
}
