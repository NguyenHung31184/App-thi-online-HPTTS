/**
 * Nén ảnh trước khi gửi Edge `upload-exam-file` (giới hạn 2MB phía server).
 * Xuất JPEG để dung lượng nhỏ, vẫn đủ cho OCR / evidence.
 */

/** Dưới ngưỡng này không cần nén theo dung lượng (để margin so với 2MB server). */
export const EXAM_UPLOAD_SOFT_MAX_BYTES = 1_900_000;

/** Trên điện thoại: ảnh <2MB nhưng rất nhiều MP vẫn dễ làm canvas/toBlob lỗi hoặc multipart kém ổn định — ép resize. */
const MOBILE_PIXEL_FORCE = 8_000_000;
const MOBILE_LONG_SIDE_FORCE = 2048;

function isLikelyMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function loadAsImageBitmap(input: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(input);
  } catch {
    const url = URL.createObjectURL(input);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Không đọc được ảnh.'));
        img.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function bitmapToJpegBlob(bitmap: ImageBitmap, maxLongSide: number, quality: number): Promise<Blob> {
  let w = bitmap.width;
  let h = bitmap.height;
  const long = Math.max(w, h);
  if (long > maxLongSide && long > 0) {
    const scale = maxLongSide / long;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Canvas 2D không khả dụng.'));
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Không tạo được JPEG.'))),
      'image/jpeg',
      Math.min(0.95, Math.max(0.35, quality))
    );
  });
}

/** Lặp giảm chất lượng / cạnh cho tới khi ≤ maxBytes (hoặc hết bước). */
async function encodeJpegUntilUnderMax(
  bitmap: ImageBitmap,
  maxBytes: number,
  initialMaxLongSide: number,
  initialQuality: number
): Promise<Blob> {
  let maxLongSide = Math.min(initialMaxLongSide, Math.max(bitmap.width, bitmap.height));
  let quality = initialQuality;
  const minQ = 0.38;
  const minSide = 360;

  for (let i = 0; i < 28; i++) {
    const blob = await bitmapToJpegBlob(bitmap, maxLongSide, quality);
    if (blob.size <= maxBytes) {
      return blob;
    }
    if (quality > minQ + 0.02) {
      quality -= 0.07;
    } else {
      quality = 0.82;
      maxLongSide = Math.max(minSide, Math.round(maxLongSide * 0.82));
    }
  }
  return bitmapToJpegBlob(bitmap, minSide, minQ);
}

/**
 * Trả về Blob JPEG (hoặc nguyên bản nếu đã nhỏ — **chỉ desktop**).
 * **Mobile:** luôn tái mã hóa JPEG khi decode được bitmap, tránh HEIC / nhãn MIME sai (gây lỗi magic bytes trên Edge).
 */
export async function compressImageForExamUpload(
  input: File | Blob,
  maxBytes: number = EXAM_UPLOAD_SOFT_MAX_BYTES
): Promise<Blob> {
  const mobile = isLikelyMobile();
  const overByteLimit = input.size > maxBytes;

  if (!mobile && !overByteLimit) {
    return input;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadAsImageBitmap(input);
  } catch {
    if (overByteLimit) {
      throw new Error('Không đọc được ảnh để nén.');
    }
    return input;
  }

  try {
    if (!mobile && overByteLimit) {
      const startSide = Math.min(2048, Math.max(bitmap.width, bitmap.height));
      return encodeJpegUntilUnderMax(bitmap, maxBytes, startSide, 0.86);
    }

    if (mobile) {
      const longSide = Math.max(bitmap.width, bitmap.height);
      const pixels = bitmap.width * bitmap.height;
      const aggressive = longSide > MOBILE_LONG_SIDE_FORCE || pixels > MOBILE_PIXEL_FORCE;
      const capStart = aggressive ? 1600 : Math.min(2048, longSide);
      const q0 = aggressive ? 0.82 : 0.85;
      return encodeJpegUntilUnderMax(bitmap, maxBytes, capStart, q0);
    }

    throw new Error('compressImageForExamUpload: trạng thái không hợp lệ.');
  } finally {
    bitmap.close();
  }
}
