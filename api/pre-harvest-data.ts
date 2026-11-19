import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const { handlePreHarvestData } = await import(
    '../server/pre-harvest/live-data.js'
  );
  await handlePreHarvestData(req, res);
}
