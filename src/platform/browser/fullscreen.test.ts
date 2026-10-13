import { describe, expect, it, vi } from 'vitest';
import { activeFullscreenElement, listenForFullscreenChange, requestPageFullscreen, supportsFullscreen, type FullscreenDocument } from './fullscreen';

function doc(fields: object): FullscreenDocument {
  return fields as FullscreenDocument;
}

describe('fullscreen browser capabilities', () => {
  it('requests standard fullscreen and reads the actual element', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const element = { requestFullscreen };
    const document = doc({ documentElement: element, fullscreenEnabled: true, fullscreenElement: element });
    expect(supportsFullscreen(document)).toBe(true);
    await requestPageFullscreen(document);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(activeFullscreenElement(document)).toBe(element);
  });

  it('supports prefixed Safari APIs and events', async () => {
    const webkitRequestFullscreen = vi.fn();
    const element = { webkitRequestFullscreen };
    const document = doc({ documentElement: element, webkitFullscreenElement: element });
    expect(supportsFullscreen(document)).toBe(true);
    await requestPageFullscreen(document);
    expect(webkitRequestFullscreen).toHaveBeenCalledOnce();
    expect(activeFullscreenElement(document)).toBe(element);
    const events = new EventTarget();
    const listener = vi.fn();
    const cleanup = listenForFullscreenChange(events as Document, listener);
    events.dispatchEvent(new Event('webkitfullscreenchange'));
    events.dispatchEvent(new Event('fullscreenchange'));
    expect(listener).toHaveBeenCalledTimes(2);
    cleanup();
    events.dispatchEvent(new Event('fullscreenchange'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not claim fullscreen when unsupported or disabled', async () => {
    const requestFullscreen = vi.fn();
    const document = doc({ documentElement: { requestFullscreen }, fullscreenEnabled: false });
    expect(supportsFullscreen(document)).toBe(false);
    expect(activeFullscreenElement(document)).toBeNull();
    await expect(requestPageFullscreen(document)).rejects.toMatchObject({ name: 'NotSupportedError' });
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('propagates permission rejection without inventing a fullscreen state', async () => {
    const error = new DOMException('Requires user gesture', 'NotAllowedError');
    const document = doc({ documentElement: { requestFullscreen: vi.fn().mockRejectedValue(error) } });
    await expect(requestPageFullscreen(document)).rejects.toBe(error);
    expect(activeFullscreenElement(document)).toBeNull();
  });
});
