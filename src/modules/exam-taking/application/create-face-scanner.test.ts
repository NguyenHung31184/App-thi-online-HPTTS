import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), release: vi.fn(), detect: vi.fn(), blazeLoad: vi.fn(), blazeDetect: vi.fn() }));
vi.mock('./mediapipe-face-proctor', () => ({ loadMediaPipeFaceDetector: mocks.load, releaseMediaPipeFaceDetector: mocks.release, detectFacesWithMediaPipe: mocks.detect }));
vi.mock('./blaze-face-proctor', () => ({ loadBlazeFaceModel: mocks.blazeLoad, detectFacesInVideo: mocks.blazeDetect }));
import { createFaceScanner } from './create-face-scanner';

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('face scanner compatibility fallback', () => {
  it('falls back when a browser exposes Worker but refuses construction', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker denied'); } });
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal('createImageBitmap', vi.fn());
    const detector = {};
    mocks.load.mockResolvedValue(detector);
    mocks.detect.mockReturnValue(1);
    const scanner = await createFaceScanner(new AbortController().signal);
    expect(scanner.mode).toBe('mediapipe');
    expect(await scanner.detect({} as HTMLVideoElement)).toBe(1);
    scanner.close();
    expect(mocks.release).toHaveBeenCalledWith(detector);
  });

  it('releases a fallback detector that finishes loading after cancellation', async () => {
    const controller = new AbortController();
    let resolve!: (detector: object) => void;
    mocks.load.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const rejected = expect(createFaceScanner(controller.signal, false)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    const detector = {};
    resolve(detector);
    await rejected;
    expect(mocks.release).toHaveBeenCalledWith(detector);
    expect(mocks.blazeLoad).not.toHaveBeenCalled();
  });

  it('retains BlazeFace fallback when MediaPipe fails', async () => {
    mocks.load.mockRejectedValue(new Error('WASM unavailable'));
    mocks.blazeLoad.mockResolvedValue({});
    mocks.blazeDetect.mockResolvedValue({ count: 1 });
    const scanner = await createFaceScanner(new AbortController().signal, false);
    expect(scanner.mode).toBe('blazeface');
    expect(await scanner.detect({} as HTMLVideoElement)).toBe(1);
  });
});
