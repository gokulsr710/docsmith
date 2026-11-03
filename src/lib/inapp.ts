/**
 * In-app browsers (Instagram, Facebook, TikTok…) run pages in a WebView that
 * ignores `<a download>` for files generated in the page, so downloads silently
 * fail. These helpers detect them and offer working alternatives.
 */
import { downloadBlob } from './files';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

const APPS: [RegExp, string][] = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'Facebook'],
  [/BytedanceWebview|musical_ly|TikTok/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/\bLine\//i, 'LINE'],
  [/Twitter/i, 'X'],
];

// In development, `?inapp=Instagram` simulates an in-app browser for testing.
const devOverride = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('inapp') : null;

export const inAppBrowser: string | null = devOverride || (APPS.find(([re]) => re.test(ua))?.[1] ?? null);
export const isAndroid = /Android/i.test(ua);
export const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);

/** Tries to reopen the current page in the phone's default browser. */
export function openInExternalBrowser() {
  const { host, pathname, search, href } = window.location;
  if (isAndroid) {
    // Android intent URL: opens the default browser, falling back to the same URL.
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  } else if (isIOS) {
    // Supported by iOS 17+; older versions ignore it and the user follows the manual steps.
    window.location.href = `x-safari-${href}`;
  }
}

/** Opens the native share sheet with the file (lets iOS users "Save to Files"). */
async function shareFile(blob: Blob, name: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (e) {
    return (e as Error)?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

export const DOWNLOAD_BLOCKED_EVENT = 'docsmith:download-blocked';

/**
 * Saves a generated file. In normal browsers this is a regular download. Inside
 * in-app browsers it uses the share sheet when available, and otherwise asks the
 * user to open the site in their real browser.
 */
export async function saveFile(blob: Blob, name: string) {
  if (!inAppBrowser) return downloadBlob(blob, name);
  const shared = await shareFile(blob, name);
  if (shared === 'unsupported') window.dispatchEvent(new CustomEvent(DOWNLOAD_BLOCKED_EVENT));
}
