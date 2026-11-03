import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MoreHorizontal, TriangleAlert, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { DOWNLOAD_BLOCKED_EVENT, inAppBrowser, isAndroid, isIOS, openInExternalBrowser } from '../../lib/inapp';

const browserName = isIOS ? 'Safari' : isAndroid ? 'Chrome' : 'your browser';

function useCopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link and open it in your browser:', window.location.href);
    }
  };
  return { copied, copy };
}

function Steps() {
  return (
    <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
      <li className="flex gap-2">
        <span className="font-semibold">1.</span>
        <span>
          Tap the <MoreHorizontal className="inline size-4 align-text-bottom" aria-label="three dots" /> menu in the {isIOS ? 'bottom-right or ' : ''}top-right corner.
        </span>
      </li>
      <li className="flex gap-2">
        <span className="font-semibold">2.</span>
        <span>
          Choose <strong>“Open in {isIOS ? 'external browser' : 'Chrome'}”</strong> (or “Open in browser”).
        </span>
      </li>
    </ol>
  );
}

/**
 * Shown only inside in-app browsers (Instagram, Facebook…), where downloads of
 * generated files don't work. Explains how to open the site in a real browser.
 */
export function InAppBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const { copied, copy } = useCopyLink();

  useEffect(() => {
    const onBlocked = () => setBlocked(true);
    window.addEventListener(DOWNLOAD_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(DOWNLOAD_BLOCKED_EVENT, onBlocked);
  }, []);

  if (!inAppBrowser) return null;

  return (
    <>
      {!dismissed && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100" role="region" aria-label="Browser notice">
          <div className="mx-auto flex max-w-7xl items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Downloads may not work in {inAppBrowser}’s browser</p>
              <p className="mt-0.5 opacity-90">Open this page in {browserName} before adding files, so you can save the results.</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(isAndroid || isIOS) && (
                  <Button size="sm" icon={ExternalLink} onClick={openInExternalBrowser}>
                    Open in {browserName}
                  </Button>
                )}
                <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
                  {copied ? 'Link copied' : 'Copy link'}
                </Button>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="-m-1 rounded-lg p-1.5 opacity-70 hover:opacity-100" aria-label="Dismiss notice">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {blocked && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="blocked-title">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setBlocked(false)} />
          <div className="relative w-full max-w-md animate-slide-up rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:animate-scale-in sm:rounded-3xl dark:bg-slate-900">
            <button onClick={() => setBlocked(false)} className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close">
              <X className="size-5" />
            </button>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <TriangleAlert className="size-6" aria-hidden />
            </span>
            <h2 id="blocked-title" className="mt-4 text-lg font-bold">
              {inAppBrowser} blocks downloads
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {inAppBrowser}’s built-in browser can’t save files. Open this page in {browserName}, add your files again, and the download will work.
            </p>
            <Steps />
            <div className="mt-5 flex flex-col gap-2">
              {(isAndroid || isIOS) && (
                <Button size="lg" icon={ExternalLink} onClick={openInExternalBrowser}>
                  Open in {browserName}
                </Button>
              )}
              <Button size="lg" variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
                {copied ? 'Link copied — paste it in your browser' : 'Copy link'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
