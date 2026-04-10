/**
 * Nén ảnh trước khi gửi Edge `upload-exam-file` (giới hạn 2MB phía server).
 * Xuất JPEG để dung lượng nhỏ, vẫn đủ cho OCR / evidence.
 */

/** Dưới ngưỡng này không cần nén (để margin so với 2MB server). */
export const EXAM_UPLOAD_SOFT_MAX_BYTES = 1_900_000;

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
  if (input.size <= maxBytes) {
    return input;
  }

  const bitmap = await loadAsImageBitmap(input);
  try {
    let maxLongSide = Math.min(2048, Math.max(bitmap.width, bitmap.height));
    let quality = 0.86;
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
