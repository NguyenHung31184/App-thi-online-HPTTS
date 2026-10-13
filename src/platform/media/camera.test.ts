import { afterEach, describe, expect, it, vi } from 'vitest';
import { cameraHasUsableTrack, openCamera, playCameraVideo } from './camera';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function mockStream(muted = false) {
  const track = { readyState: 'live', muted, stop: vi.fn() };
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream };
}

describe('camera acquisition lifecycle', () => {
  it('releases a stream received after leaving the camera step', async () => {
    let resolve!: (stream: MediaStream) => void;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>((r) => { resolve = r; }) } });
    const controller = new AbortController();
    const camera = openCamera({ video: true }, { signal: controller.signal });
    const rejection = expect(camera).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejection;
    const { stream, track } = mockStream();
    resolve(stream);
    await Promise.resolve();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('times out and releases a camera permission result that arrives late', async () => {
    vi.useFakeTimers();
    let resolve!: (stream: MediaStream) => void;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>((r) => { resolve = r; }) } });
    const camera = openCamera({ video: true }, { signal: new AbortController().signal, timeoutMs: 100 });
    const rejection = expect(camera).rejects.toThrow('Camera chưa phản hồi');
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    const { stream, track } = mockStream();
    resolve(stream);
    await Promise.resolve();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('does not acquire a camera for an already cancelled session', async () => {
    const acquire = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: acquire } });
    const controller = new AbortController();
    controller.abort();
    await expect(openCamera({ video: true }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(acquire).not.toHaveBeenCalled();
  });

  it('treats a muted live track as interrupted, not as usable video', () => {
    expect(cameraHasUsableTrack(mockStream(true).stream)).toBe(false);
    expect(cameraHasUsableTrack(mockStream().stream)).toBe(true);
  });

  it('waits for actual pixels after play resolves', async () => {
    const video = Object.assign(new EventTarget(), { readyState: 0, paused: false, videoWidth: 0, videoHeight: 0, play: vi.fn().mockResolvedValue(undefined) });
    let ready = false;
    const playback = playCameraVideo(video as unknown as HTMLVideoElement, new AbortController().signal).then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    Object.assign(video, { readyState: 2, videoWidth: 640, videoHeight: 480 });
    video.dispatchEvent(new Event('loadeddata'));
    await playback;
    expect(ready).toBe(true);
  });

  it('allows recovery when video.play never resolves', async () => {
    vi.useFakeTimers();
    const video = Object.assign(new EventTarget(), { play: () => new Promise(() => {}) });
    const rejected = expect(playCameraVideo(video as unknown as HTMLVideoElement, new AbortController().signal, 100)).rejects.toThrow('Camera chưa phát hình');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });

  it('cancels a pending video warmup when its session stops', async () => {
    const controller = new AbortController();
    const video = Object.assign(new EventTarget(), { play: () => new Promise(() => {}) });
    const rejected = expect(playCameraVideo(video as unknown as HTMLVideoElement, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
  });
});
