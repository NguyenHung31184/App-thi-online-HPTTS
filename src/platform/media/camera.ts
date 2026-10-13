export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function cameraHasUsableTrack(stream: MediaStream | null): boolean {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live' && !track.muted));
}

export function playCameraVideo(video: HTMLVideoElement, signal: AbortSignal, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      video.removeEventListener('loadeddata', ready);
      video.removeEventListener('playing', ready);
    };
    const ready = () => {
      if (video.readyState < 2 || video.paused || !video.videoWidth || !video.videoHeight) return;
      cleanup();
      resolve();
    };
    const fail = (error: unknown) => { cleanup(); reject(error); };
    const abort = () => fail(new DOMException('Camera playback cancelled', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Camera chưa phát hình. Kiểm tra quyền camera rồi bấm thử lại.')), timeoutMs);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    video.addEventListener('loadeddata', ready);
    video.addEventListener('playing', ready);
    void video.play().then(ready, fail);
  });
}

/** getUserMedia cannot be aborted; release streams that arrive after cancellation or timeout. */
export function openCamera(
  constraints: MediaStreamConstraints,
  options: { signal: AbortSignal; timeoutMs?: number },
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', abort);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(new DOMException('Camera session cancelled', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Camera chưa phản hồi. Kiểm tra quyền camera rồi bấm thử lại.')), options.timeoutMs ?? 15_000);
    if (options.signal.aborted) {
      abort();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      fail(new Error('Trình duyệt không hỗ trợ camera. Hãy mở bằng HTTPS trong Safari hoặc Chrome.'));
      return;
    }
    options.signal.addEventListener('abort', abort, { once: true });
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (settled) {
        stopCamera(stream);
        return;
      }
      settled = true;
      cleanup();
      resolve(stream);
    }, fail);
  });
}
