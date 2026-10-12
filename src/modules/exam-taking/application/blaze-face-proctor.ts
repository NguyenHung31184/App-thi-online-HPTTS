/**
 * BlazeFace — phát hiện mặt nhẹ (client), dùng cho:
 * - Ảnh bắt đầu thi: kiểm tra 0 / 1 / nhiều mặt + crop chân dung 3:4
 * - Burst giám sát: đếm mặt thay cho heuristic COCO "person"
 */
import type { NormalizedFace } from '@tensorflow-models/blazeface';

export interface FaceBoxPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

let modelPromise: Promise<import('@tensorflow-models/blazeface').BlazeFaceModel> | null = null;

export function resetBlazeFaceModelCache(): void {
  modelPromise = null;
}

/** Load model một lần (dùng chung ExamTakePage + AiObjectProctorBurst). */
export async function loadBlazeFaceModel(): Promise<import('@tensorflow-models/blazeface').BlazeFaceModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import('@tensorflow/tfjs');
      const blazeface = await import('@tensorflow-models/blazeface');
      return blazeface.load({
        maxFaces: 6,
        scoreThreshold: 0.65,
      });
    })();
  }
  return modelPromise;
}

function faceToBox(f: NormalizedFace): FaceBoxPx | null {
  const tl = f.topLeft;
  const br = f.bottomRight;
  if (!Array.isArray(tl) || !Array.isArray(br) || tl.length < 2 || br.length < 2) return null;
  const x = Number(tl[0]);
  const y = Number(tl[1]);
  const x2 = Number(br[0]);
  const y2 = Number(br[1]);
  const w = Math.max(1, x2 - x);
  const h = Math.max(1, y2 - y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, w, h };
}

/**
 * Đếm mặt + box (pixel trên buffer gốc của video — cùng hệ với canvas.drawImage(video)).
 * `flipHorizontal: true` trong BlazeFace chỉ **lật tọa độ đầu ra** cho preview đã mirror (CSS scaleX(-1)),
 * không khớp pixel gốc → khi **crop bằng drawImage** phải dùng `false`.
 */
export async function detectFacesInVideo(
  video: HTMLVideoElement,
  flipHorizontal: boolean,
): Promise<{ count: number; boxes: FaceBoxPx[] }> {
  const model = await loadBlazeFaceModel();
  const faces = await model.estimateFaces(video, false, flipHorizontal, false);
  const boxes = faces.map(faceToBox).filter((b): b is FaceBoxPx => b != null);
  return { count: boxes.length, boxes };
}

export function pickLargestFace(boxes: FaceBoxPx[]): FaceBoxPx | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
}

const PORTRAIT_W_OVER_H = 3 / 4;

/**
 * Vùng cắt chân dung tỉ lệ 3:4 (rộng:cao), căn theo khuôn mặt + đệm.
 */
export function portraitCrop3x4FromFace(vw: number, vh: number, face: FaceBoxPx): { sx: number; sy: number; sw: number; sh: number } {
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  const pad = Math.max(face.w, face.h) * 0.5;
  let targetW = face.w + pad * 2;
  let targetH = face.h + pad * 2;
  if (targetW / targetH > PORTRAIT_W_OVER_H) {
    targetH = targetW / PORTRAIT_W_OVER_H;
  } else {
    targetW = targetH * PORTRAIT_W_OVER_H;
  }
  let sx = Math.round(cx - targetW / 2);
  let sy = Math.round(cy - targetH / 2 - face.h * 0.08);
  sx = Math.max(0, Math.min(sx, vw - 1));
  sy = Math.max(0, Math.min(sy, vh - 1));
  let sw = Math.min(Math.round(targetW), vw - sx);
  let sh = Math.min(Math.round(targetH), vh - sy);
  const ar = sw / Math.max(1, sh);
  if (ar > PORTRAIT_W_OVER_H + 0.02) {
    sw = Math.round(sh * PORTRAIT_W_OVER_H);
  } else if (ar < PORTRAIT_W_OVER_H - 0.02) {
    sh = Math.round(sw / PORTRAIT_W_OVER_H);
  }
  sw = Math.max(1, Math.min(sw, vw - sx));
  sh = Math.max(1, Math.min(sh, vh - sy));
  return { sx, sy, sw, sh };
}

/** Fallback khi không detect được: cắt giữa khung, tỉ lệ 3:4. */
export function centerPortraitCrop3x4(vw: number, vh: number): { sx: number; sy: number; sw: number; sh: number } {
  let sw = vw;
  let sh = Math.round(sw / PORTRAIT_W_OVER_H);
  if (sh > vh) {
    sh = vh;
    sw = Math.round(sh * PORTRAIT_W_OVER_H);
  }
  const sx = Math.max(0, Math.round((vw - sw) / 2));
  const sy = Math.max(0, Math.round((vh - sh) / 2));
  return { sx, sy, sw, sh };
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh JPEG.'))),
      'image/jpeg',
      quality,
    );
  });
}

export type StartPortraitResult =
  | { ok: true; blob: Blob }
  | { ok: false; reason: 'no_face' | 'multiple_faces' | 'model_error' | 'not_ready' };

/**
 * Kiểm tra đúng 1 khuôn mặt + tạo JPEG chân dung 3:4 crop theo mặt (mục 1 + kiểm tra 2a lúc vào thi).
 */
export async function validateAndBuildStartExamPortrait(
  video: HTMLVideoElement,
  opts: { flipHorizontal: boolean; jpegQuality: number; maxLongSide: number },
): Promise<StartPortraitResult> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return { ok: false, reason: 'not_ready' };

  try {
    const { count, boxes } = await detectFacesInVideo(video, opts.flipHorizontal);
    if (count === 0) return { ok: false, reason: 'no_face' };
    if (count > 1) return { ok: false, reason: 'multiple_faces' };
    const face = pickLargestFace(boxes);
    if (!face) return { ok: false, reason: 'no_face' };

    const crop = portraitCrop3x4FromFace(vw, vh, face);
    const longSide = Math.max(crop.sw, crop.sh);
    const scale = longSide > opts.maxLongSide ? opts.maxLongSide / longSide : 1;
    const outW = Math.max(1, Math.round(crop.sw * scale));
    const outH = Math.max(1, Math.round(crop.sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'model_error' };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);

    const blob = await canvasToJpegBlob(canvas, opts.jpegQuality);
    return { ok: true, blob };
  } catch {
    return { ok: false, reason: 'model_error' };
  }
}
