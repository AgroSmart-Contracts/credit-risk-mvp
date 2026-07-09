import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const { handleAnalyzeDocuments } = await import(
    '../server/analyze-documents'
  );
  await handleAnalyzeDocuments(req, res);
}
