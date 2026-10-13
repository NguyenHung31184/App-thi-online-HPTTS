import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkerFaceScanner } from './worker-face-scanner';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function worker() {
  const port = { onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'], postMessage: vi.fn(), terminate: vi.fn() };
  const message = (data: object) => port.onmessage?.call(port as unknown as Worker, { data } as MessageEvent);
  return { port, message };
}

async function readyScanner() {
  const fake = worker();
  const scanner = new WorkerFaceScanner(fake.port);
  const initialized = scanner.initialize();
  fake.message({ kind: 'ready' });
  await initialized;
  return { ...fake, scanner };
}

describe('face worker lifecycle', () => {
  it('releases its worker if initialization times out', async () => {
    vi.useFakeTimers();
    const { port } = worker();
    const scanner = new WorkerFaceScanner(port);
    const rejected = expect(scanner.initialize(100)).rejects.toThrow('initialization timed out');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(port.terminate).toHaveBeenCalledOnce();
  });

  it('rejects pending initialization when the exam leaves the page', async () => {
    const { port } = worker();
    const scanner = new WorkerFaceScanner(port);
    const rejected = expect(scanner.initialize()).rejects.toThrow('closed');
    scanner.close();
    await rejected;
    expect(port.terminate).toHaveBeenCalledOnce();
  });

  it('transfers a bounded frame, resolves its count and prevents overlapping scans', async () => {
    const { scanner, port, message } = await readyScanner();
    const bitmap = { close: vi.fn() };
    const createBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal('createImageBitmap', createBitmap);
    const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
    const detection = scanner.detect(video);
    await expect(scanner.detect(video)).rejects.toThrow('already in flight');
    expect(createBitmap).toHaveBeenCalledWith(video, { resizeWidth: 640, resizeHeight: 360 });
    const request = port.postMessage.mock.calls.find(([value]) => value.kind === 'detect')?.[0];
    expect(request).toBeDefined();
    message({ kind: 'result', id: request.id, count: 2 });
    expect(await detection).toBe(2);
    expect(bitmap.close).not.toHaveBeenCalled();
    scanner.close();
  });

  it('closes an untransferred bitmap received after cancellation', async () => {
    const { scanner, port } = await readyScanner();
    let resolve!: (bitmap: ImageBitmap) => void;
    vi.stubGlobal('createImageBitmap', () => new Promise<ImageBitmap>((r) => { resolve = r; }));
    const detection = scanner.detect({ videoWidth: 640, videoHeight: 480 } as HTMLVideoElement);
    const rejected = expect(detection).rejects.toThrow('closed');
    scanner.close();
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    resolve(bitmap);
    await rejected;
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(port.postMessage.mock.calls).toHaveLength(1);
  });

  it('rejects an unresponsive scan instead of accumulating frames', async () => {
    vi.useFakeTimers();
    const { scanner, port } = await readyScanner();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));
    const rejected = expect(scanner.detect({ videoWidth: 640, videoHeight: 480 } as HTMLVideoElement)).rejects.toThrow('inference timed out');
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    expect(port.terminate).toHaveBeenCalledOnce();
  });
});
