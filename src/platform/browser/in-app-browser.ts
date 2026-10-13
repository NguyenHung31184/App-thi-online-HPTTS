export interface InAppBrowser {
  /** Name of the app whose built-in browser shows the page, as students know it. */
  app: string;
  ios: boolean;
  /**
   * The embedded browser refuses inline video: a camera preview opens in the system's full-screen player and
   * pauses when the student leaves it, so no live frame reaches the page. Seen in Zalo on iPhone, 2026-10-13.
   */
  blocksInlineCamera: boolean;
}

const APPS: [RegExp, string][] = [
  [/\bZalo\b/i, 'Zalo'],
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/Messenger/i, 'Messenger'],
  [/Instagram/i, 'Instagram'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'TikTok'],
  [/\bLine\//, 'Line'],
];

/** The app whose embedded browser is showing the page, read from the user agent; null in a real browser. */
export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const match = APPS.find(([pattern]) => pattern.test(userAgent));
  if (!match) return null;
  const ios = /iPhone|iPad|iPod/.test(userAgent);
  return { app: match[1], ios, blocksInlineCamera: ios && match[1] === 'Zalo' };
}

/** Address that asks iOS (17 and later) to open the page in Safari; older versions ignore it. */
export function safariUrl(href: string): string {
  return href.replace(/^http(s?):\/\//, 'x-safari-http$1://');
}

export function currentInAppBrowser(): InAppBrowser | null {
  return typeof navigator === 'undefined' ? null : detectInAppBrowser(navigator.userAgent);
}
