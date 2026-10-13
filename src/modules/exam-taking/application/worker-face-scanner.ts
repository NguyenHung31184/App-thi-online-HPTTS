import type { FaceScanner, FaceWorkerResponse } from '../domain/face-scanner';

type WorkerPort = Pick<Worker, 'onmessage' | 'onerror' | 'postMessage' | 'terminate'>;
type PendingRequest = {
  resolve: (count: number) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class WorkerFaceScanner implements FaceScanner {
  readonly mode = 'worker' as const;
  private worker: WorkerPort;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();
  private closed = false;
  private busy = false;
  private initReject: ((error: Error) => void) | null = null;

  constructor(worker: WorkerPort) { this.worker = worker; }

  async initialize(timeoutMs = 20_000, assets?: { libraryUrl: string; wasmBase: string; modelUrl: string }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Face worker initialization timed out')), timeoutMs);
      this.initReject = (error) => { clearTimeout(timer); reject(error); };
      this.worker.onerror = () => this.fail(new Error('Face worker unavailable'));
      this.worker.onmessage = (event: MessageEvent<FaceWorkerResponse>) => {
        const message = event.data;
        if (message.kind === 'ready') {
          clearTimeout(timer);
          this.initReject = null;
          resolve();
        } else if (message.kind === 'error') {
          this.fail(new Error(message.message));
        } else {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          pending.resolve(message.count);
        }
      };
      try { this.worker.postMessage({ kind: 'init', ...assets }); }
      catch (error) { this.fail(error instanceof Error ? error : new Error('Face worker failed')); }
    });
  }

  async detect(video: HTMLVideoElement): Promise<number> {
    if (this.closed) throw new Error('Face worker closed');
    if (this.busy) throw new Error('Face inference already in flight');
    this.busy = true;
    let bitmap: ImageBitmap | null = null;
    try {
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      bitmap = await createImageBitmap(video, {
        resizeWidth: Math.max(1, Math.round(video.videoWidth * scale)),
        resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)),
      });
      if (this.closed) throw new Error('Face worker closed');
      const frame = bitmap;
      return await new Promise<number>((resolve, reject) => {
        const id = ++this.nextId;
        const timer = setTimeout(() => this.fail(new Error('Face inference timed out')), 5_000);
        this.pending.set(id, { resolve, reject, timer });
        try {
          this.worker.postMessage({ kind: 'detect', id, bitmap: frame, timestamp: performance.now() }, [frame]);
          bitmap = null;
        } catch (error) {
          this.fail(error instanceof Error ? error : new Error('Unable to transfer camera frame'));
        }
      });
    } finally {
      bitmap?.close();
      this.busy = false;
    }
  }

  private fail(error: Error): void {
    this.initReject?.(error);
    this.initReject = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.closed = true;
    this.worker.terminate();
  }

  close(): void { this.fail(new Error('Face worker closed')); }
}
