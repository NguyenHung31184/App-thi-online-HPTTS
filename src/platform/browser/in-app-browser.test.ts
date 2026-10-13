import { describe, expect, it } from 'vitest';
import { detectInAppBrowser, safariUrl } from './in-app-browser';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

describe('detectInAppBrowser', () => {
  it('finds Zalo on iPhone and marks the camera as unusable there', () => {
    expect(detectInAppBrowser(`${IPHONE} Zalo iOS/525 ZaloTheme/light ZaloLanguage/vi`)).toEqual({ app: 'Zalo', ios: true, blocksInlineCamera: true });
  });

  it('finds Zalo on Android without blocking the camera', () => {
    expect(detectInAppBrowser(`${ANDROID} Zalo android/12100772 ZaloTheme/light`)).toEqual({ app: 'Zalo', ios: false, blocksInlineCamera: false });
  });

  it('finds other embedded browsers', () => {
    expect(detectInAppBrowser(`${IPHONE} [FBAN/FBIOS;FBAV/470.0]`)?.app).toBe('Facebook');
    expect(detectInAppBrowser(`${IPHONE} Instagram 340.0`)?.app).toBe('Instagram');
    expect(detectInAppBrowser(`${IPHONE} Instagram 340.0`)?.blocksInlineCamera).toBe(false);
  });

  it('returns null in Safari and Chrome', () => {
    expect(detectInAppBrowser(`${IPHONE} Version/17.5 Mobile/15E148 Safari/604.1`)).toBeNull();
    expect(detectInAppBrowser(ANDROID)).toBeNull();
  });
});

describe('safariUrl', () => {
  it('swaps the scheme and keeps the rest of the address', () => {
    expect(safariUrl('https://app.example.vn/student/exams?x=1')).toBe('x-safari-https://app.example.vn/student/exams?x=1');
    expect(safariUrl('http://localhost:5199/login')).toBe('x-safari-http://localhost:5199/login');
  });
});
