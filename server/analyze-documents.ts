import Busboy from 'busboy';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { analyzeUploadedPdfs, type UploadedPdfFile } from './analyze-uploaded-pdfs';

const MAX_FILE_BYTES = 30 * 1024 * 1024;

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseMultipart(
  req: IncomingMessage,
  body: Buffer,
): Promise<UploadedPdfFile[]> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const files: UploadedPdfFile[] = [];
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_FILE_BYTES, files: 20 },
    });

    busboy.on(
      'file',
      (
        _fieldName: string,
        file: NodeJS.ReadableStream,
        info: { filename?: string; mimeType?: string },
      ) => {
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => chunks.push(chunk));
        file.on('limit', () => {
          file.resume();
        });
        file.on('end', () => {
          if (!info.filename) return;
          files.push({
            fileName: info.filename,
            buffer: Buffer.concat(chunks),
            mimeType: info.mimeType,
          });
        });
      },
    );

    busboy.on('finish', () => resolve(files));
    busboy.on('error', reject);
    busboy.end(body);
  });
}

export async function handleAnalyzeDocuments(
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
    const files = await parseMultipart(req, body);

    if (!files.length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'At least one file is required' }));
      return;
    }

    const result = await analyzeUploadedPdfs(files);
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
            : 'Document analysis failed',
      }),
    );
  }
}
