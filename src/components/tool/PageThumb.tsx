import type { ReactNode } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { formatBytes } from '../../lib/files';

/** A PDF page preview tile. */
export function PageThumb({
  src,
  label,
  rotation = 0,
  state = 'normal',
  overlay,
  footer,
  onClick,
  ariaLabel,
}: {
  src?: string;
  label: ReactNode;
  rotation?: number;
  state?: 'normal' | 'selected' | 'removed' | 'dragging';
  overlay?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const ring =
    state === 'selected'
      ? 'ring-2 ring-brand-500 border-brand-500'
      : state === 'removed'
        ? 'ring-2 ring-rose-500 border-rose-500'
        : state === 'dragging'
          ? 'ring-2 ring-brand-500 shadow-lift scale-[1.03]'
          : 'hover:shadow-lift';
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className={`group card relative flex h-full flex-col p-2 transition ${ring}`}>
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={onClick ? state === 'selected' || state === 'removed' : undefined}
        className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2 dark:bg-white/5"
      >
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            className={`max-h-full max-w-full bg-white shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 select-none ${state === 'removed' ? 'opacity-30 grayscale' : ''}`}
            style={{ transform: `rotate(${rotation}deg)`, ...(rotation % 180 ? { maxWidth: '75%', maxHeight: '75%' } : {}) }}
          />
        ) : (
          <Loader2 className="size-5 animate-spin text-slate-300" aria-hidden />
        )}
        {overlay}
      </Tag>
      <div className="mt-1.5 flex min-h-8 items-center justify-between gap-1 px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        <span className="tabular-nums">{label}</span>
        {footer}
      </div>
    </div>
  );
}

export function PdfFileHeader({ file, pageCount }: { file: File; pageCount: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FileText className="size-4 shrink-0 text-rose-500" aria-hidden />
      <span className="truncate">{file.name}</span>
      <span className="shrink-0 font-normal text-slate-400">
        · {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {formatBytes(file.size)}
      </span>
    </span>
  );
}

export const thumbGridClass = 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 xl:grid-cols-6';
