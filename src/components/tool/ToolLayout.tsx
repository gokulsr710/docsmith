import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, ShieldCheck, SlidersHorizontal, Trash2, X, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dropzone } from '../ui/Dropzone';
import { ProgressBar } from '../ui/controls';
import { ResultPanel } from './ResultPanel';
import type { ToolRun } from './useToolRun';
import { useToast } from '../../context/toast';
import { useHandoff } from '../../context/session';
import { acceptAttr, acceptLabel, partitionFiles, type AcceptKind } from '../../lib/files';
import { TOOLS, type Tool } from '../../lib/tools';
import { usePageMeta } from '../../lib/seo';

interface ToolLayoutProps {
  tool: Tool;
  accept: AcceptKind[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  hasFiles: boolean;
  run: ToolRun;
  onReset: () => void;
  action: { label: string; icon?: LucideIcon; onClick: () => void; disabled?: boolean; hint?: string };
  /** Main workspace (file gallery, page grid, editor…). */
  children: ReactNode;
  settings?: ReactNode;
  /** Heading shown above the workspace, e.g. "4 images". */
  heading?: ReactNode;
  toolbar?: ReactNode;
  dropTitle?: string;
  resetLabel?: string;
  /** Shown under the description on the empty state. */
  notice?: ReactNode;
}

export function ToolLayout({
  tool,
  accept,
  multiple = true,
  onFiles,
  hasFiles,
  run,
  onReset,
  action,
  children,
  settings,
  heading,
  toolbar,
  dropTitle,
  resetLabel = 'Start over',
  notice,
}: ToolLayoutProps) {
  usePageMeta(tool.title, `${tool.description} Free, private and runs entirely in your browser — no uploads.`);
  const [sheetOpen, setSheetOpen] = useState(false);
  const handleFiles = useFileIntake(accept, onFiles, multiple);
  useHandoff(handleFiles);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const reset = () => {
    run.clearResult();
    onReset();
  };

  const ActionIcon = action.icon;
  const Icon = tool.icon;
  const related = TOOLS.filter((t) => t.id !== tool.id && t.categories.some((c) => tool.categories.includes(c))).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 lg:pb-12">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link to={tool.categories[0] === 'pdf' ? '/pdf-tools' : '/image-tools'} className="hover:text-slate-900 dark:hover:text-white">
          {tool.categories[0] === 'pdf' ? 'PDF Tools' : 'Image Tools'}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-slate-700 dark:text-slate-200" aria-current="page">{tool.title}</span>
      </nav>

      <header className={`flex items-start gap-4 ${hasFiles ? 'mb-6' : 'mb-8 sm:mb-10'}`}>
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tool.tint}`}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{tool.description}</p>
        </div>
      </header>

      {run.result ? (
        <ResultPanel result={run.result} onReset={reset} onBack={run.clearResult} resetLabel={resetLabel} />
      ) : !hasFiles ? (
        <div className="mx-auto max-w-3xl animate-fade-up">
          <Dropzone
            accept={acceptAttr(accept)}
            multiple={multiple}
            onFiles={handleFiles}
            size="lg"
            buttonLabel={multiple ? 'Choose Files' : 'Choose File'}
            title={dropTitle ?? (multiple ? 'drop files here' : 'drop a file here')}
            hint={`Supports ${acceptLabel(accept)}${multiple ? ' · multiple files allowed' : ''}`}
          />
          {notice && <div className="mt-4">{notice}</div>}
          <div className="mt-12">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Related tools</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {related.map((t) => {
                const RIcon = t.icon;
                return (
                  <Link key={t.id} to={t.path} className="card flex items-center gap-2.5 p-3 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-lift">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.tint}`}>
                      <RIcon className="size-4" aria-hidden />
                    </span>
                    <span className="truncate">{t.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={`grid gap-6 ${settings ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          <section className="min-w-0 animate-fade-up" aria-label="Files">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="mr-auto text-sm font-semibold text-slate-700 dark:text-slate-200">{heading}</div>
              {toolbar}
              <Button variant="danger" size="sm" icon={Trash2} onClick={reset}>
                Clear all
              </Button>
            </div>
            {children}
          </section>

          {settings && (
            <>
              {sheetOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden" onClick={() => setSheetOpen(false)} />}
              <aside
                aria-label="Settings"
                className={`fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 lg:z-auto lg:block lg:max-h-none lg:translate-y-0 lg:self-start lg:overflow-visible lg:rounded-2xl lg:border lg:px-0 lg:pt-0 lg:pb-0 lg:shadow-soft lg:sticky lg:top-24 dark:lg:bg-white/[0.04] ${
                  sheetOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
              >
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 lg:hidden dark:bg-white/20" />
                <div className="flex items-center justify-between lg:border-b lg:border-slate-100 lg:px-5 lg:py-4 dark:lg:border-white/10">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <SlidersHorizontal className="size-4 text-slate-400" aria-hidden /> Settings
                  </h2>
                  <button onClick={() => setSheetOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-white/10" aria-label="Close settings">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="space-y-6 py-4 lg:px-5 lg:py-5">{settings}</div>
                <div className="hidden border-t border-slate-100 p-5 lg:block dark:border-white/10">
                  <Button size="lg" icon={ActionIcon} className="w-full" onClick={action.onClick} disabled={action.disabled || run.busy}>
                    {action.label}
                  </Button>
                  {action.hint && <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">{action.hint}</p>}
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <ShieldCheck className="size-3.5" aria-hidden /> Processed locally on your device
                  </p>
                </div>
                <div className="lg:hidden">
                  <Button size="lg" className="w-full" onClick={() => setSheetOpen(false)} variant="secondary">
                    Done
                  </Button>
                </div>
              </aside>
            </>
          )}

          {/* Mobile sticky action bar (and desktop bar for tools without a settings panel). */}
          <div
            className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0d12]/90 ${
              settings ? 'lg:hidden' : 'lg:static lg:z-auto lg:mt-2 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none'
            }`}
          >
            <div className="mx-auto flex max-w-3xl gap-2 lg:justify-end">
              {settings && (
                <Button variant="secondary" size="lg" icon={SlidersHorizontal} onClick={() => setSheetOpen(true)} aria-label="Open settings" className="px-4">
                  <span className="hidden min-[400px]:inline">Settings</span>
                </Button>
              )}
              <Button size="lg" icon={ActionIcon} className="flex-1 lg:flex-none" onClick={action.onClick} disabled={action.disabled || run.busy}>
                {action.label}
              </Button>
            </div>
            {action.hint && <p className="mt-1.5 text-center text-xs text-slate-500 lg:text-right dark:text-slate-400">{action.hint}</p>}
          </div>
        </div>
      )}

      {run.progress && <ProcessingOverlay value={run.progress.value} label={run.progress.label} />}
    </div>
  );
}

/** Validates incoming files (type, size, count) and reports rejections as toasts. */
export function useFileIntake(accept: AcceptKind[], onFiles: (files: File[]) => void, multiple = true) {
  const toast = useToast();
  return (files: File[]) => {
    const list = multiple ? files : files.slice(0, 1);
    const { valid, rejected } = partitionFiles(list, accept);
    if (rejected.length) {
      toast.error(
        rejected.length === 1 ? `Couldn't add “${rejected[0].file.name}”` : `${rejected.length} files were skipped`,
        rejected.length === 1 ? rejected[0].reason : `Only ${acceptLabel(accept)} files are supported.`,
      );
    }
    if (!multiple && files.length > 1) toast.info('This tool works with one file at a time', `Using “${files[0].name}”.`);
    if (valid.length) onFiles(valid);
  };
}

function ProcessingOverlay({ value, label }: { value: number; label: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm" role="alertdialog" aria-busy="true" aria-label="Processing">
      <div className="card w-full max-w-sm animate-scale-in p-6 text-center dark:bg-slate-900">
        <Loader2 className="mx-auto size-8 animate-spin text-brand-600" aria-hidden />
        <p className="mt-4 font-semibold">Processing your files</p>
        <p className="mt-1 min-h-5 truncate text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {label}
        </p>
        <ProgressBar value={value} className="mt-5" />
        <p className="mt-2 text-xs font-medium text-slate-400 tabular-nums">{Math.round(value * 100)}%</p>
      </div>
    </div>
  );
}
