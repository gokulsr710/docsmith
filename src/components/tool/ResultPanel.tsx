import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileArchive, FileText, RotateCcw, TrendingDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatBytes, percentSaved, zipFiles } from '../../lib/files';
import { saveFile } from '../../lib/inapp';
import { useToast } from '../../context/toast';
import type { ToolResult } from './useToolRun';

export function ResultPanel({ result, onReset, onBack, resetLabel }: { result: ToolResult; onReset: () => void; onBack: () => void; resetLabel: string }) {
  const toast = useToast();
  const [zipping, setZipping] = useState<number | null>(null);
  const { outputs } = result;
  const single = outputs.length === 1;

  const previews = useMemo(() => outputs.map((o) => (o.blob.type.startsWith('image/') ? URL.createObjectURL(o.blob) : null)), [outputs]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const downloadAll = async () => {
    if (single) return saveFile(outputs[0].blob, outputs[0].name);
    try {
      setZipping(0);
      const zip = await zipFiles(outputs, (p) => setZipping(p));
      saveFile(zip, result.zipName);
    } catch {
      toast.error('Could not create the ZIP file', 'Try downloading the files individually.');
    } finally {
      setZipping(null);
    }
  };

  const totalSize = outputs.reduce((s, o) => s + o.blob.size, 0);
  const saved = result.compare ? percentSaved(result.compare.before, result.compare.after) : 0;

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center px-5 pt-10 pb-8 text-center sm:px-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/5">
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{result.title ?? 'Your files are ready!'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {result.message ?? (single ? `${outputs[0].name} · ${formatBytes(outputs[0].blob.size)}` : `${outputs.length} files · ${formatBytes(totalSize)} total`)}
          </p>

          {result.compare && (
            <div className="mt-6 grid w-full max-w-md grid-cols-3 items-center gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Before</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatBytes(result.compare.before)}</p>
              </div>
              <div className="flex flex-col items-center">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${
                    saved > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  <TrendingDown className="size-4" aria-hidden />
                  {saved > 0 ? `-${saved}%` : '0%'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">After</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatBytes(result.compare.after)}</p>
              </div>
            </div>
          )}
          {result.note && <p className="mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{result.note}</p>}

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" icon={single ? Download : FileArchive} onClick={downloadAll} loading={zipping !== null} className="w-full sm:w-auto">
              {zipping !== null ? `Zipping… ${Math.round(zipping * 100)}%` : single ? 'Download' : `Download all (ZIP)`}
            </Button>
            <Button size="lg" variant="secondary" icon={RotateCcw} onClick={onReset} className="w-full sm:w-auto">
              {resetLabel}
            </Button>
          </div>
          <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Back to edit settings
          </button>
        </div>

        {!single && (
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100 dark:divide-white/5 dark:border-white/10">
            {outputs.map((o, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-white/10">
                  {previews[i] ? <img src={previews[i]!} alt="" className="size-full object-cover" loading="lazy" /> : <FileText className="size-5 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {o.originalSize ? (
                      <>
                        {formatBytes(o.originalSize)} → {formatBytes(o.blob.size)}{' '}
                        <span className={percentSaved(o.originalSize, o.blob.size) > 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}>
                          ({percentSaved(o.originalSize, o.blob.size) > 0 ? '-' : '+'}
                          {Math.abs(percentSaved(o.originalSize, o.blob.size))}%)
                        </span>
                      </>
                    ) : (
                      formatBytes(o.blob.size)
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="sm" icon={Download} onClick={() => saveFile(o.blob, o.name)} aria-label={`Download ${o.name}`}>
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Files are kept in memory only for this session and are cleared when you start over or close the tab.</p>
    </div>
  );
}
