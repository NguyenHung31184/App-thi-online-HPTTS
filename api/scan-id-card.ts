/**
 * Vercel serverless proxy: nhận ảnh CCCD từ client, forward lên Supabase Edge Function
 * `scan-id-card` với API key giữ server-side (không bundle vào client JS).
 *
 * Env vars (Vercel project settings — KHÔNG dùng VITE_ prefix):
 *   POTENTIAL_STUDENT_API_KEY  — API key gọi scan-id-card (cùng giá trị với chatbot)
 *   SUPABASE_URL               — URL Supabase project (optional, fallback = VITE_SUPABASE_URL)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60 };

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/$/, '');

const API_KEY = process.env.POTENTIAL_STUDENT_API_KEY || '';

function applyCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SUPABASE_URL || !API_KEY) {
    res.status(500).json({ error: 'Thiếu cấu hình server (SUPABASE_URL / POTENTIAL_STUDENT_API_KEY).' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) as unknown : req.body;

    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/scan-id-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });

    const data = await upstream.json() as unknown;
    res.status(upstream.status).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi proxy OCR CCCD.';
    res.status(500).json({ error: msg });
  }
}
