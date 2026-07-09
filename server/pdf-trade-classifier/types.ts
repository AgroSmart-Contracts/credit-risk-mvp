export const DocumentType = {
  PurchaseOrderOrContract: 'Purchase Order or Contract',
  CommercialInvoice: 'Commercial Invoice',
  BillOfLadingOrAwb: 'Bill of Lading or AWB',
  CertificateOfOrigin: 'Certificate of Origin',
  PackingList: 'Packing List',
  PhytosanitaryCertificate: 'Phytosanitary Certificate',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DOCUMENT_TYPES = [
  DocumentType.PurchaseOrderOrContract,
  DocumentType.CommercialInvoice,
  DocumentType.BillOfLadingOrAwb,
  DocumentType.CertificateOfOrigin,
  DocumentType.PackingList,
  DocumentType.PhytosanitaryCertificate,
] as const;

export type ClassifiedDocumentType = DocumentType | 'Unknown';

export type ParsedPdfResult = {
  filePath: string;
  text: string;
  textPreview: string;
  metadata?: Record<string, unknown>;
};

export type ClassificationRule = {
  type: DocumentType;
  keywords: string[];
};
