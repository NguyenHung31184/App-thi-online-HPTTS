export type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};
export type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function supportsFullscreen(doc: FullscreenDocument): boolean {
  const element = doc.documentElement as FullscreenElement;
  return (typeof element.requestFullscreen === 'function' && doc.fullscreenEnabled !== false)
    || (typeof element.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled !== false);
}

export function activeFullscreenElement(doc: FullscreenDocument): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export async function requestPageFullscreen(doc: FullscreenDocument): Promise<void> {
  const element = doc.documentElement as FullscreenElement;
  if (typeof element.requestFullscreen === 'function' && doc.fullscreenEnabled !== false) {
    await element.requestFullscreen();
  } else if (typeof element.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled !== false) {
    await element.webkitRequestFullscreen();
  } else {
    throw new DOMException('Fullscreen unavailable', 'NotSupportedError');
  }
}

export function listenForFullscreenChange(doc: Document, listener: () => void): () => void {
  doc.addEventListener('fullscreenchange', listener);
  doc.addEventListener('webkitfullscreenchange', listener);
  return () => {
    doc.removeEventListener('fullscreenchange', listener);
    doc.removeEventListener('webkitfullscreenchange', listener);
  };
}
