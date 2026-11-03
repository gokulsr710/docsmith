import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, Combine, GripVertical, Loader2, X } from 'lucide-react';
import { ToolLayout, useFileIntake } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { SortableGrid, noDrag } from '../components/ui/SortableGrid';
import { Dropzone } from '../components/ui/Dropzone';
import { Button } from '../components/ui/Button';
import { acceptAttr, errorMessage, formatBytes, nextFrame, pluralize, uid } from '../lib/files';
import { loadPdfLib, openPdf, pdfBlob, renderThumbnail } from '../lib/pdf';
import { getTool } from '../lib/tools';
import { useToast } from '../context/toast';

interface PdfItem {
  id: string;
  file: File;
  pages: number;
  thumb?: string;
}

export default function MergePdf() {
  const tool = getTool('merge-pdf');
  const run = useToolRun(tool.id);
  const toast = useToast();
  const [items, setItems] = useState<PdfItem[]>([]);
  const [pending, setPending] = useState(0);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const add = async (files: File[]) => {
    setPending((n) => n + files.length);
    for (const file of files) {
      try {
        const doc = await openPdf(await file.arrayBuffer());
        const thumb = await renderThumbnail(doc, 1, 120).catch(() => undefined);
        if (thumb) urls.current.add(thumb);
        const item = { id: uid(), file, pages: doc.numPages, thumb };
        await doc.destroy();
        setItems((prev) => [...prev, item]);
      } catch (e) {
        toast.error(`Couldn't add “${file.name}”`, errorMessage(e));
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const remove = (id: string) =>
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it?.thumb) URL.revokeObjectURL(it.thumb);
      return prev.filter((p) => p.id !== id);
    });

  const clear = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setItems([]);
  };

  const intake = useFileIntake(['pdf'], add);
  const totalPages = items.reduce((s, i) => s + i.pages, 0);

  const merge = () =>
    run.start(async (report) => {
      const { PDFDocument } = await import('pdf-lib');
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        report(i / items.length, `Merging ${items[i].file.name}…`);
        await nextFrame();
        const src = await loadPdfLib(await items[i].file.arrayBuffer()).catch((e) => {
          throw new Error(`${items[i].file.name}: ${errorMessage(e)}`);
        });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      report(0.95, 'Saving merged PDF…');
      const blob = pdfBlob(await out.save());
      return {
        outputs: [{ name: 'merged.pdf', blob }],
        zipName: 'merged.zip',
        title: 'Your PDFs are merged!',
        message: `${pluralize(items.length, 'file')} · ${pluralize(totalPages, 'page')} · ${formatBytes(blob.size)}`,
      };
    });

  return (
    <ToolLayout
      tool={tool}
      accept={['pdf']}
      onFiles={add}
      hasFiles={items.length > 0 || pending > 0}
      run={run}
      onReset={clear}
      heading={`${pluralize(items.length, 'PDF')} · ${pluralize(totalPages, 'page')}`}
      toolbar={
        items.length > 1 && (
          <Button variant="ghost" size="sm" icon={ArrowDownAZ} onClick={() => setItems([...items].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))}>
            Sort A–Z
          </Button>
        )
      }
      action={{
        label: 'Merge PDF',
        icon: Combine,
        onClick: merge,
        disabled: items.length < 2 || pending > 0,
        hint: items.length < 2 ? 'Add at least 2 PDFs to merge' : 'Drag files to change their order',
      }}
    >
      <SortableGrid
        items={items}
        onReorder={setItems}
        layout="list"
        className="flex flex-col gap-2.5"
        itemLabel={(it, i) => `${i + 1}: ${it.file.name}`}
        renderItem={(it, i, dragging) => (
          <div className={`card flex items-center gap-3 p-2.5 pr-3 transition ${dragging ? 'shadow-lift ring-2 ring-brand-500' : 'hover:shadow-lift'}`}>
            <GripVertical className="size-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400 tabular-nums">{i + 1}</span>
            <div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
              {it.thumb ? <img src={it.thumb} alt="" className="max-h-full max-w-full" draggable={false} /> : <Loader2 className="size-4 animate-spin text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.file.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pluralize(it.pages, 'page')} · {formatBytes(it.file.size)}
              </p>
            </div>
            <button
              {...noDrag}
              onClick={() => remove(it.id)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              aria-label={`Remove ${it.file.name}`}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      />
      {pending > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Reading {pluralize(pending, 'file')}…
        </p>
      )}
      <div className="mt-3">
        <Dropzone compact accept={acceptAttr(['pdf'])} onFiles={intake} />
      </div>
    </ToolLayout>
  );
}
