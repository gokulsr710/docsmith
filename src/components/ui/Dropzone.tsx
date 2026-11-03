import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { CloudUpload, Plus, ShieldCheck } from 'lucide-react';
import { buttonClass } from './Button';

interface DropzoneProps {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  buttonLabel?: string;
  /** Compact variant used for "add more files" inside a workspace. */
  compact?: boolean;
  size?: 'md' | 'lg';
}

export function Dropzone({
  accept,
  multiple = true,
  onFiles,
  title = 'drag & drop files here',
  hint,
  buttonLabel = 'Choose Files',
  compact,
  size = 'md',
}: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const open = () => input.current?.click();

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  const dragProps = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      depth.current++;
      setOver(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: handleDrop,
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      className="hidden"
      accept={accept}
      multiple={multiple}
      data-testid="file-input"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (files.length) onFiles(files);
      }}
    />
  );

  if (compact) {
    return (
      <div
        {...dragProps}
        role="button"
        tabIndex={0}
        onKeyDown={onKey}
        onClick={open}
        aria-label={multiple ? 'Add more files' : 'Replace file'}
        className={`flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center text-sm font-medium transition ${
          over
            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
            : 'border-slate-200 text-slate-500 hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 dark:border-white/10 dark:text-slate-400 dark:hover:bg-brand-500/5'
        }`}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10">
          <Plus className="size-5" aria-hidden />
        </span>
        {multiple ? 'Add more' : 'Replace'}
        {fileInput}
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      className={`group relative rounded-3xl border-2 border-dashed transition-all duration-200 ${
        over
          ? 'scale-[1.01] border-brand-500 bg-brand-50/80 dark:bg-brand-500/10'
          : 'border-slate-300/80 bg-white hover:border-brand-400 dark:border-white/15 dark:bg-white/[0.03]'
      } ${size === 'lg' ? 'px-5 py-10 sm:py-14' : 'px-5 py-10 sm:py-12'}`}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`mb-4 flex size-14 items-center justify-center rounded-2xl transition-colors sm:size-16 ${
            over ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
          }`}
        >
          <CloudUpload className="size-7 sm:size-8" aria-hidden />
        </div>
        <button type="button" onClick={open} className={buttonClass('primary', 'lg', 'min-w-48')}>
          {buttonLabel}
        </button>
        <p className="mt-3 hidden text-sm text-slate-500 sm:block dark:text-slate-400">{over ? 'Release to upload' : `or ${title}`}</p>
        {hint && <p className="mt-2 text-xs text-slate-400 sm:mt-1 dark:text-slate-500">{hint}</p>}
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="size-3.5" aria-hidden />
          Files are processed on your device — never uploaded
        </p>
      </div>
      {fileInput}
    </div>
  );
}
