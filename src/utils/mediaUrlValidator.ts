/**
 * Validate URL video/media cho câu hỏi essay.
 * Chỉ cho phép các nguồn đáng tin: YouTube, Vimeo, và Supabase Storage của chính dự án.
 * Ngăn admin vô tình nhập link từ nguồn lạ có thể gây rủi ro.
 */

const ALLOWED_HOSTNAMES = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
];

/** Lấy hostname Supabase của dự án từ biến môi trường (vd: "abc.supabase.co") */
function getSupabaseHostname(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export interface MediaUrlValidationResult {
  valid: boolean;
  /** Thông báo lỗi nếu không hợp lệ */
  error?: string;
}

/**
 * Kiểm tra URL media có được phép không.
 * @param url - URL cần kiểm tra (có thể rỗng)
 * @returns { valid: true } nếu OK hoặc URL rỗng; { valid: false, error } nếu không hợp lệ
 */
export function validateMediaUrl(url: string): MediaUrlValidationResult {
  const trimmed = url.trim();
  if (!trimmed) return { valid: true }; // Rỗng là hợp lệ (media_url optional)

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'URL không hợp lệ. Vui lòng kiểm tra lại định dạng.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL phải dùng HTTPS.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Kiểm tra danh sách nguồn được phép
  if (ALLOWED_HOSTNAMES.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
    return { valid: true };
  }

  // Kiểm tra Supabase Storage của chính dự án
  const supabaseHost = getSupabaseHostname();
  if (supabaseHost && hostname === supabaseHost) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Nguồn video không được phép. Chỉ chấp nhận: YouTube, Vimeo, hoặc Supabase Storage của dự án. (Nguồn hiện tại: ${hostname})`,
  };
}
