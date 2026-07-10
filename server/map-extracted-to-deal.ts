import type { ExtractedDocumentFields } from './pdf-trade-classifier/index.js';
import type { DealFieldSuggestions } from '../src/lib/document-analysis/types.js';
import { inferProductFromText } from './product-inference.js';

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function inferCountryFromLocation(
  location?: string | null,
): string | undefined {
  const raw = nonEmpty(location);
  if (!raw) return undefined;
  const upper = raw.toUpperCase();

  const known: Array<[RegExp, string]> = [
    [/\bPERU\b|\bPERUVIAN\b|\bLIMA\b|\bCALLAO\b/i, 'Peru'],
    [/\bCOLOMBIA\b|\bBUENAVENTURA\b/i, 'Colombia'],
    [/\bDOMINICAN\b|\bCAUCEDO\b/i, 'Dominican Republic'],
    [/\bCHILE\b/i, 'Chile'],
    [/\bUSA\b|\bUNITED\s+STATES\b|\bMIAMI\b/i, 'United States'],
    [/\bNETHERLANDS\b|\bROTTERDAM\b/i, 'Netherlands'],
    [/\bSPAIN\b/i, 'Spain'],
    [/\bECUADOR\b/i, 'Ecuador'],
    [/\bMEXICO\b|\bMÉXICO\b/i, 'Mexico'],
    [/\bBRAZIL\b|\bBRASIL\b/i, 'Brazil'],
    [/\bARGENTINA\b/i, 'Argentina'],
    [/\bISRAEL\b/i, 'Israel'],
  ];

  for (const [pattern, country] of known) {
    if (pattern.test(upper)) return country;
  }

  return undefined;
}

function formatQuantityLabel(extracted: ExtractedDocumentFields): string | undefined {
  const contract = extracted.contract;
  const packing = extracted.packingList;
  const co = extracted.certificateOfOrigin;

  if (contract?.quantityKg != null) {
    const boxes =
      contract.quantityBoxes != null
        ? ` (~${Math.round(contract.quantityBoxes).toLocaleString('en-US')} boxes)`
        : '';
    return `${contract.quantityKg.toLocaleString('en-US')} kg netos${boxes}`;
  }

  if (packing?.boxCount != null) {
    return `${packing.boxCount.toLocaleString('en-US')} boxes`;
  }

  if (co?.grossWeightKg != null) {
    return `${co.grossWeightKg.toLocaleString('en-US')} kg gross`;
  }

  return undefined;
}

function mapQualityGrade(extracted: ExtractedDocumentFields): string | undefined {
  const category = extracted.packingList?.category;
  if (category) {
    if (/CAT\s*I/i.test(category)) return 'Grade A / Class I';
    if (/CAT\s*II/i.test(category)) return 'Grade B / Class II';
  }
  const productText = [
    extracted.contract?.productName,
    extracted.packingList?.productVariety,
  ]
    .filter(Boolean)
    .join(' ');
  if (/\b(mandarin|citrus|murcott)\b/i.test(productText)) {
    return 'Grade A / Class I';
  }
  return undefined;
}

function isSalesAgreement(
  fileName?: string,
  rawText?: string,
): boolean {
  const lower = (fileName ?? '').toLowerCase();
  if (/\b(venta|sales)\b/.test(lower)) return true;
  if (!rawText) return false;
  if (/\bacuerdo de ventas\b/i.test(rawText)) return true;
  if (/\bsales agreement\b/i.test(rawText)) return true;
  // TM sales contracts list TRU MARKET as seller ("Vendedor").
  if (
    /\bTRU\s*MARKET[\s\S]{0,240}["(]\s*Vendedor\s*[")]/i.test(rawText) ||
    /["(]\s*Vendedor\s*[")][\s\S]{0,240}\bTRU\s*MARKET/i.test(rawText)
  ) {
    return true;
  }
  return false;
}

function isPurchaseDocument(
  documentType?: string,
  fileName?: string,
  rawText?: string,
): boolean {
  if (isSalesAgreement(fileName, rawText)) return false;

  const lower = (fileName ?? '').toLowerCase();
  if (documentType === 'purchase_order') return true;
  if (lower.includes('orden') && lower.includes('compra')) return true;
  if (lower.includes('purchase') && lower.includes('order')) return true;
  // Match document titles/headers only — boilerplate often mentions "esta orden de compra".
  if (rawText && /^\s*orden\s+de\s+compra\b/im.test(rawText)) return true;
  if (rawText && /^\s*purchase\s+order\b/im.test(rawText)) return true;
  if (rawText && /\bacuerdo de compra\b/i.test(rawText)) return true;
  return false;
}

function normalizeRuc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? digits : undefined;
}

export function mapExtractedFieldsToDealSuggestions(
  extracted: ExtractedDocumentFields,
  options?: { documentType?: string; fileName?: string },
): DealFieldSuggestions {
  const { common, contract } = extracted;

  const buyerName =
    nonEmpty(contract?.buyerName) ?? nonEmpty(common.consigneeName);
  const supplierName =
    nonEmpty(contract?.supplierName) ?? nonEmpty(common.exporterName);

  const product =
    inferProductFromText(contract?.productName) ??
    inferProductFromText(extracted.certificateOfOrigin?.goodsDescription) ??
    inferProductFromText(extracted.packingList?.productVariety) ??
    inferProductFromText(common.rawText);

  const variety =
    nonEmpty(contract?.variety) ??
    nonEmpty(extracted.packingList?.productVariety);

  const total =
    contract?.totalValueUSD ??
    contract?.subtotalUSD ??
    extracted.invoice?.invoiceTotal ??
    extracted.invoice?.invoiceSubtotal ??
    undefined;

  const origin =
    inferCountryFromLocation(common.originLocation) ??
    inferCountryFromLocation(extracted.billOfLadingOrAwb?.portOfLoading) ??
    'Peru';

  const destination =
    inferCountryFromLocation(contract?.dischargePort) ??
    inferCountryFromLocation(common.destinationLocation) ??
    inferCountryFromLocation(extracted.billOfLadingOrAwb?.portOfDischarge);

  const paymentTerms =
    nonEmpty(contract?.paymentTerms) ??
    nonEmpty(extracted.invoice?.paymentTerms);

  const supplierRuc =
    normalizeRuc(contract?.supplierTaxId) ??
    normalizeRuc(common.exporterTaxId);

  const purchaseDoc = isPurchaseDocument(
    options?.documentType,
    options?.fileName,
    common.rawText ?? undefined,
  );

  return {
    dealRef: nonEmpty(contract?.orderNumber),
    product,
    variety,
    quantityLabel: formatQuantityLabel(extracted),
    dealValueUSD: !purchaseDoc && total != null ? total : undefined,
    purchaseTotalUSD: purchaseDoc && total != null ? total : undefined,
    supplierRuc,
    origin,
    destination,
    incoterm: nonEmpty(contract?.incoterm) ?? nonEmpty(common.incoterm),
    buyerName,
    supplierName,
    paymentTerms,
    advancePaymentPct: contract?.advancePaymentPct ?? undefined,
    qualityGrade: mapQualityGrade(extracted),
  };
}
