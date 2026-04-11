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

/**
 * Trả về Blob JPEG (hoặc nguyên bản nếu đã nhỏ).
 */
export async function compressImageForExamUpload(
  input: File | Blob,
  maxBytes: number = EXAM_UPLOAD_SOFT_MAX_BYTES
): Promise<Blob> {
  const mobile = isLikelyMobile();
  const overByteLimit = input.size > maxBytes;

  if (!overByteLimit && !mobile) {
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
    const longSide = Math.max(bitmap.width, bitmap.height);
    const pixels = bitmap.width * bitmap.height;
    const needsShrinkForMobile =
      mobile && (longSide > MOBILE_LONG_SIDE_FORCE || pixels > MOBILE_PIXEL_FORCE);

    if (!overByteLimit && !needsShrinkForMobile) {
      return input;
    }

    const capStart = mobile ? 1600 : 2048;
    let maxLongSide = Math.min(capStart, longSide);
    let quality = mobile ? 0.82 : 0.86;
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

    return await bitmapToJpegBlob(bitmap, minSide, minQ);
  } finally {
    bitmap.close();
  }
}
