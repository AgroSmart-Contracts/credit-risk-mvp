import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { basename } from 'node:path';

import type { ParsedPdfResult } from './types.js';

const require = createRequire(import.meta.url);

/** pdf-parse@1.1.1 is CJS (module.exports = fn). Use require() so tsc does not emit `.default`. */
const pdfParse = require('pdf-parse') as (
  data: Buffer,
  options?: { version?: string },
) => Promise<{ text: string; numpages: number }>;

/** pdf-parse v1 — no @napi-rs/canvas (required by pdf-parse v2, breaks on Vercel). */
export async function parsePdf(filePath: string): Promise<ParsedPdfResult> {
  const buffer = await fs.readFile(filePath);
  return parsePdfBuffer(buffer, filePath);
}

export async function parsePdfBuffer(
  buffer: Buffer | Uint8Array,
  filePath = 'uploaded-file.pdf',
): Promise<ParsedPdfResult> {
  // pdf-parse uses pdf.js internally and some PDFs can fail depending on the
  // bundled pdf.js build. In serverless environments we may see "invalid PDF"
  // errors for specific files that parse locally.
  //
  // Try a small set of pdf.js versions before giving up.
  const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let data: { text: string; numpages: number } | null = null;
  const errors: unknown[] = [];

  for (const version of ['v1.10.100', 'v1.10.88', 'v1.9.426'] as const) {
    try {
      data = await pdfParse(pdfBuffer, { version });
      break;
    } catch (err) {
      errors.push(err);
    }
  }

  if (!data) {
    // Re-throw the last error to keep error reporting consistent upstream.
    throw errors[errors.length - 1] ?? new Error('pdf-parse failed');
  }

  const text = normalizeText(data.text ?? '');

  return {
    filePath,
    text,
    textPreview: text.slice(0, 500),
    metadata: {
      fileName: basename(filePath),
      pages: data.numpages,
    },
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
