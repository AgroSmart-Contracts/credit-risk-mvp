import type { DealFieldSuggestions } from '../src/lib/document-analysis/types.js';

const KEYS: (keyof DealFieldSuggestions)[] = [
  'dealRef',
  'product',
  'variety',
  'quantityLabel',
  'dealValueUSD',
  'purchaseTotalUSD',
  'supplierRuc',
  'origin',
  'destination',
  'incoterm',
  'buyerName',
  'supplierName',
  'paymentTerms',
  'advancePaymentPct',
  'qualityGrade',
];

export function mergeDealFieldSuggestions(
  parts: DealFieldSuggestions[],
): DealFieldSuggestions {
  const merged: DealFieldSuggestions = {};
  const extractedTotals: number[] = [];

  for (const part of parts) {
    if (part.dealValueUSD != null && part.dealValueUSD > 0) {
      extractedTotals.push(part.dealValueUSD);
    }
    if (part.purchaseTotalUSD != null && part.purchaseTotalUSD > 0) {
      extractedTotals.push(part.purchaseTotalUSD);
    }
  }

  for (const key of KEYS) {
    if (key === 'dealValueUSD') {
      let best: number | undefined;
      for (const part of parts) {
        const value = part.dealValueUSD;
        if (value != null && value > 0 && (best == null || value > best)) {
          best = value;
        }
      }
      if (best == null && extractedTotals.length >= 2) {
        best = Math.max(...extractedTotals);
      }
      if (best != null) merged.dealValueUSD = best;
      continue;
    }

    if (key === 'purchaseTotalUSD') {
      let best: number | undefined;
      for (const part of parts) {
        const value = part.purchaseTotalUSD;
        if (value != null && value > 0 && (best == null || value < best)) {
          best = value;
        }
      }
      if (best == null && extractedTotals.length >= 2) {
        const maxTotal = Math.max(...extractedTotals);
        const minTotal = Math.min(...extractedTotals);
        if (minTotal < maxTotal) best = minTotal;
      }
      if (best != null) merged.purchaseTotalUSD = best;
      continue;
    }

    if (key === 'advancePaymentPct') {
      for (const part of parts) {
        if (part.advancePaymentPct != null) {
          merged.advancePaymentPct = part.advancePaymentPct;
          break;
        }
      }
      continue;
    }

    for (const part of parts) {
      const value = part[key as keyof DealFieldSuggestions];
      if (value === undefined || value === null || value === '') continue;
      (merged as Record<string, unknown>)[key as string] = value;
      break;
    }
  }

  return merged;
}

export function listFilledDealFieldKeys(
  suggestions: DealFieldSuggestions,
): string[] {
  return KEYS.filter((key) => {
    const value = suggestions[key];
    return value !== undefined && value !== null && value !== '';
  }).map(String);
}

export function estimateDocCoveragePct(
  suggestions: DealFieldSuggestions,
): number {
  const weighted: Array<[keyof DealFieldSuggestions, number]> = [
    ['product', 12],
    ['variety', 8],
    ['dealValueUSD', 15],
    ['purchaseTotalUSD', 10],
    ['buyerName', 12],
    ['supplierName', 12],
    ['origin', 10],
    ['destination', 10],
    ['incoterm', 8],
    ['paymentTerms', 10],
    ['quantityLabel', 8],
    ['qualityGrade', 5],
  ];

  let earned = 0;
  let total = 0;
  for (const [key, weight] of weighted) {
    total += weight;
    const value = suggestions[key];
    if (value !== undefined && value !== null && value !== '') {
      earned += weight;
    }
  }

  return Math.min(95, Math.max(35, Math.round((earned / total) * 100)));
}
