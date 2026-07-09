import Busboy from 'busboy';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { extractCofaceFromPdfBuffer } from './coface-extraction';

const MAX_FILE_BYTES = 30 * 1024 * 1024;

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseSingleFile(
  req: IncomingMessage,
  body: Buffer,
): Promise<{ fileName: string; buffer: Buffer } | null> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return null;
  }

  return new Promise((resolve, reject) => {
    let result: { fileName: string; buffer: Buffer } | null = null;
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    });

    busboy.on(
      'file',
      (
        _fieldName: string,
        file: NodeJS.ReadableStream,
        info: { filename?: string },
      ) => {
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => chunks.push(chunk));
        file.on('end', () => {
          if (!info.filename) return;
          result = {
            fileName: info.filename,
            buffer: Buffer.concat(chunks),
          };
        });
      },
    );

    busboy.on('finish', () => resolve(result));
    busboy.on('error', reject);
    busboy.end(body);
  });
}

export async function handleAnalyzeCofaceDocument(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readRequestBody(req);
    const file = await parseSingleFile(req, body);

    if (!file) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'A PDF file is required' }));
      return;
    }

    const ext = file.fileName.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          message: 'Coface auto-fill supports PDF limit notifications only',
        }),
      );
      return;
    }

    const result = await extractCofaceFromPdfBuffer(file.buffer);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message:
          error instanceof Error
            ? error.message
            : 'Coface document analysis failed',
      }),
    );
  }
}
