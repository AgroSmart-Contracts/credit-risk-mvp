import { createRequire } from 'node:module';

import type {
  CofaceExtractionResult,
  CofaceRiskGrade,
} from '../src/lib/coface-analysis/types.js';

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
function toCoverageAmountUSD(amount: number, _currency: string): number {
  return Math.round(amount);
}

function parseAmountFromLine(
  text: string,
  pattern: RegExp,
): { currency: string; amount: number } | null {
  const match = text.match(pattern);
  if (!match) return null;
  const currency = match[1].toUpperCase();
  const amount = parseMoney(match[2]);
  if (amount == null) return null;
  return { currency, amount };
}

const COFACE_GRADE_PATTERN = '(A[1-4]|[BCD])';

function parseCofaceGrade(token: string): CofaceRiskGrade | undefined {
  const g = token.toUpperCase();
  const valid: CofaceRiskGrade[] = ['A1', 'A2', 'A3', 'A4', 'B', 'C', 'D'];
  return valid.includes(g as CofaceRiskGrade) ? (g as CofaceRiskGrade) : undefined;
}

function parseRiskGrade(
  text: string,
  kind: 'country' | 'company',
): CofaceRiskGrade | undefined {
  const grade = COFACE_GRADE_PATTERN;
  const patterns =
    kind === 'country'
      ? [
          new RegExp(`\\bCRA\\b[^A-Z0-9]{0,24}${grade}\\b`, 'i'),
          new RegExp(
            `Country\\s+risk\\s+(?:assessment\\s*)?[:\s]+${grade}\\b`,
            'i',
          ),
          new RegExp(`Country\\s+risk\\s+rating[:\s]+${grade}\\b`, 'i'),
          new RegExp(
            `National\\s+risk\\s+(?:assessment\\s*)?[:\s]+${grade}\\b`,
            'i',
          ),
        ]
      : [
          new RegExp(`\\bDRA\\b[^A-Z0-9]{0,24}${grade}\\b`, 'i'),
          new RegExp(
            `Company\\s+risk\\s+(?:assessment\\s*)?[:\s]+${grade}\\b`,
            'i',
          ),
          new RegExp(`Company\\s+risk\\s+rating[:\s]+${grade}\\b`, 'i'),
          new RegExp(
            `(?:Debtor|Buyer)\\s+risk\\s+(?:assessment\\s*)?[:\s]+${grade}\\b`,
            'i',
          ),
        ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    const parsed = m?.[1] ? parseCofaceGrade(m[1]) : undefined;
    if (parsed) return parsed;
  }
  return undefined;
}

function parseCountryName(text: string): string | undefined {
  const patterns = [
    /Country[:\s]+([A-Za-z][A-Za-z\s]{2,48}?)(?:\s+(?:RNC|NIT|Tax|Debtor|Company)|$)/i,
    /Debtor\s+country[:\s]+([A-Za-z][A-Za-z\s]{2,48}?)(?:\s|$)/i,
    /Country\s+of\s+risk[:\s]+([A-Za-z][A-Za-z\s]{2,48}?)(?:\s|$)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const raw = m?.[1]?.trim();
    if (raw && raw.length >= 3 && raw.length <= 48) return raw;
  }
  return undefined;
}

export async function extractCofaceFromPdfBuffer(
  buffer: Buffer,
): Promise<CofaceExtractionResult> {
  const parsed = await pdfParse(buffer);
  const text = normalizeText(parsed.text);

  if (text.length < 40) {
    throw new Error('Could not extract readable text from Coface PDF');
  }

  const requested = parseAmountFromLine(
    text,
    /You requested:\s*([A-Z]{3})\s*([0-9][0-9.,\s]+)/i,
  );

  const guaranteed = parseAmountFromLine(
    text,
    /Guaranteed Amount:\s*([A-Z]{3})\s*([0-9][0-9.,\s]+)/i,
  );

  const approvedSource = guaranteed ?? requested;
  if (!approvedSource) {
    throw new Error(
      'No guaranteed credit limit found — expected a Coface limit notification PDF',
    );
  }

  const currency = approvedSource.currency;
  const guaranteedAmount = approvedSource.amount;
  const coverageAmountUSD = toCoverageAmountUSD(guaranteedAmount, currency);

  const debtorName =
    text
      .match(/Debtor:\s*([A-Z0-9][A-Z0-9\s.&-]{4,60}?)(?:\s+CARRERA|\s+NIT|\s+Easy|\s+Country)/i)?.[1]
      ?.trim() ?? undefined;

  const decisionDate =
    text.match(/Decision date:\s*([0-3]?\d\/[01]?\d\/\d{4})/i)?.[1] ??
    text.match(/Date:\s*([0-3]?\d\/[01]?\d\/\d{4})/i)?.[1];

  const notificationNumber = text.match(
    /Notification number:\s*([0-9]+)/i,
  )?.[1];

  const country = parseCountryName(text);
  const countryRiskGrade = parseRiskGrade(text, 'country');
  const companyRiskGrade = parseRiskGrade(text, 'company');

  const requestedCoverageAmount = requested?.amount;
  const requestedCoverageAmountUSD =
    requested != null
      ? toCoverageAmountUSD(requested.amount, requested.currency)
      : undefined;

  const hintParts = [
    `${currency} ${guaranteedAmount.toLocaleString('en-US')} approved`,
    requested
      ? `requested ${requested.currency} ${requested.amount.toLocaleString('en-US')}`
      : undefined,
    debtorName,
    country,
    countryRiskGrade ? `country risk ${countryRiskGrade}` : undefined,
    companyRiskGrade ? `company risk ${companyRiskGrade}` : undefined,
    decisionDate ? `decision ${decisionDate}` : undefined,
  ].filter(Boolean);

  return {
    guaranteedAmount,
    currency,
    coverageAmountUSD,
    coverageApprovedAmountUSD: coverageAmountUSD,
    requestedCoverageAmount,
    requestedCoverageAmountUSD,
    debtorName,
    country,
    countryRiskGrade,
    companyRiskGrade,
    decisionDate,
    notificationNumber,
    extractionHint: hintParts.join(' · '),
  };
}
