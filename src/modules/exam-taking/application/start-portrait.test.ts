import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  blazeFails: 0,
  cpu: false,
  mediaPipeFails: false,
  boxes: [{ x: 10, y: 10, w: 50, h: 60 }] as { x: number; y: number; w: number; h: number }[],
}));

vi.mock('./blaze-face-proctor', () => ({
  loadBlazeFaceModel: vi.fn(async () => {
    if (state.blazeFails > 0 && !state.cpu) {
      state.blazeFails -= 1;
      throw new Error('WebGL context lost');
    }
  }),
  detectFacesInVideo: vi.fn(async () => ({ count: state.boxes.length, boxes: state.boxes })),
  pickLargestFace: (boxes: unknown[]) => boxes[0] ?? null,
  resetBlazeFaceModelCache: vi.fn(),
  buildStartPortrait: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}));

vi.mock('./mediapipe-face-proctor', () => ({
  loadMediaPipeFaceDetector: vi.fn(async () => {
    if (state.mediaPipeFails) throw new Error('wasm blocked');
    return {};
  }),
  detectFaceBoxesWithMediaPipe: vi.fn(() => state.boxes),
  releaseMediaPipeFaceDetector: vi.fn(),
}));

vi.mock('@tensorflow/tfjs', () => ({
  setBackend: vi.fn(async () => {
    state.cpu = true;
    return true;
  }),
  ready: vi.fn(async () => undefined),
}));

const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
const opts = { jpegQuality: 0.88, maxLongSide: 720 };

async function freshModule() {
  vi.resetModules();
  return import('./start-portrait');
}

describe('checkStartPortrait', () => {
  beforeEach(() => {
    state.blazeFails = 0;
    state.cpu = false;
    state.mediaPipeFails = false;
    state.boxes = [{ x: 10, y: 10, w: 50, h: 60 }];
  });

  it('uses BlazeFace when it runs, as before', async () => {
    const { checkStartPortrait } = await freshModule();
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: true, detector: 'blazeface' });
  });

  it('moves to MediaPipe when BlazeFace fails, and keeps it for the next press', async () => {
    state.blazeFails = 5;
    const { checkStartPortrait } = await freshModule();
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: true, detector: 'mediapipe' });
    state.boxes = [];
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: false, reason: 'no_face', detector: 'mediapipe' });
  });

  it('falls back to BlazeFace on the CPU when MediaPipe cannot load either', async () => {
    state.blazeFails = 1;
    state.mediaPipeFails = true;
    const { checkStartPortrait } = await freshModule();
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: true, detector: 'blazeface-cpu' });
  });

  it('reports every failure when no detector runs, then starts again from the first', async () => {
    state.blazeFails = 1;
    state.mediaPipeFails = true;
    const tf = await import('@tensorflow/tfjs');
    vi.mocked(tf.setBackend).mockRejectedValueOnce(new Error('cpu backend missing'));
    const { checkStartPortrait } = await freshModule();
    const result = await checkStartPortrait(video, opts);
    expect(result).toMatchObject({ ok: false, reason: 'model_error' });
    expect(result.ok === false && result.reason === 'model_error' ? result.detail : '').toMatch(/WebGL context lost.*wasm blocked.*cpu backend missing/);
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: true, detector: 'blazeface' });
  });

  it('refuses one face only: none and several are reported, not cropped', async () => {
    const { checkStartPortrait } = await freshModule();
    state.boxes = [];
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: false, reason: 'no_face' });
    state.boxes = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: 5, w: 1, h: 1 }];
    expect(await checkStartPortrait(video, opts)).toMatchObject({ ok: false, reason: 'multiple_faces' });
  });
});
