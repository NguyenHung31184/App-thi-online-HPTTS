import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const verifyUrl = process.env.TTDT_VERIFY_CCCD_URL || '';
const ttdtApiKey = process.env.TTDT_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ message: 'Method not allowed' }); return; }
  if (!supabaseUrl || !serviceRoleKey || !verifyUrl || !ttdtApiKey) { res.status(500).json({ message: 'Thiếu cấu hình kiểm tra CCCD trên máy chủ.' }); return; }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ message: 'Bạn chưa đăng nhập.' }); return; }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) { res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' }); return; }
  try {
    const upstream = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ttdtApiKey },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.text();
    res.status(upstream.status).send(body);
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : 'Không thể kiểm tra CCCD.' });
  }
}
