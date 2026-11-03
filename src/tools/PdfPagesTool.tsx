import { useEffect, useState } from 'react';
import { ArrowDownUp, FileDown, RotateCcw, RotateCw, Trash2, Undo2, X } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { PageThumb, PdfFileHeader, thumbGridClass } from '../components/tool/PageThumb';
import { SortableGrid, noDrag } from '../components/ui/SortableGrid';
import { Button } from '../components/ui/Button';
import { baseName, nextFrame, pluralize } from '../lib/files';
import { loadPdfLib, pdfBlob } from '../lib/pdf';
import { getTool } from '../lib/tools';

type Mode = 'rotate' | 'delete' | 'organize';

interface PageItem {
  id: string;
  index: number; // zero-based index in the source document
  rotation: number; // extra rotation applied by the user
  removed: boolean;
}

const CONFIG: Record<Mode, { toolId: string; action: string; suffix: string }> = {
  rotate: { toolId: 'rotate-pdf', action: 'Apply rotation', suffix: 'rotated' },
  delete: { toolId: 'delete-pages', action: 'Delete pages', suffix: 'edited' },
  organize: { toolId: 'organize-pdf', action: 'Save new order', suffix: 'reordered' },
};

export default function PdfPagesTool({ mode }: { mode: Mode }) {
  const cfg = CONFIG[mode];
  const tool = getTool(cfg.toolId);
  const { pdf, thumbs, loading, load, reset } = usePdfDoc();
  const run = useToolRun(tool.id);
  const [pages, setPages] = useState<PageItem[]>([]);

  useEffect(() => {
    setPages(pdf ? Array.from({ length: pdf.pageCount }, (_, i) => ({ id: `p${i}`, index: i, rotation: 0, removed: false })) : []);
  }, [pdf]);

  const patch = (id: string, fn: (p: PageItem) => Partial<PageItem>) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)));
  const rotateAll = (deg: number) => setPages((ps) => ps.map((p) => ({ ...p, rotation: (p.rotation + deg + 360) % 360 })));

  const kept = pages.filter((p) => !p.removed);
  const removedCount = pages.length - kept.length;
  const rotatedCount = pages.filter((p) => p.rotation !== 0).length;
  const reordered = pages.some((p, i) => p.index !== i);
  const changed = mode === 'rotate' ? rotatedCount > 0 : mode === 'delete' ? removedCount > 0 : reordered || removedCount > 0 || rotatedCount > 0;

  const save = () => {
    if (!pdf) return;
    run.start(async (report) => {
      report(0.1, 'Reading PDF…');
      const { PDFDocument, degrees } = await import('pdf-lib');
      const src = await loadPdfLib(pdf.bytes);
      const out = await PDFDocument.create();
      report(0.3, `Copying ${pluralize(kept.length, 'page')}…`);
      await nextFrame();
      const copied = await out.copyPages(
        src,
        kept.map((p) => p.index),
      );
      copied.forEach((page, i) => {
        const extra = kept[i].rotation;
        if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
        out.addPage(page);
      });
      report(0.8, 'Saving PDF…');
      const blob = pdfBlob(await out.save());
      const name = `${baseName(pdf.file.name)}-${cfg.suffix}.pdf`;
      return {
        outputs: [{ name, blob }],
        zipName: `${baseName(name)}.zip`,
        title: 'Your PDF is ready!',
        message: `${pluralize(kept.length, 'page')}${removedCount ? ` · ${removedCount} removed` : ''}`,
      };
    });
  };

  const toolbar =
    pdf &&
    (mode === 'rotate' ? (
      <>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => rotateAll(-90)}>
          All left
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={() => rotateAll(90)}>
          All right
        </Button>
        {rotatedCount > 0 && (
          <Button variant="ghost" size="sm" icon={Undo2} onClick={() => setPages((ps) => ps.map((p) => ({ ...p, rotation: 0 })))}>
            Reset
          </Button>
        )}
      </>
    ) : mode === 'delete' ? (
      removedCount > 0 && (
        <Button variant="ghost" size="sm" icon={Undo2} onClick={() => setPages((ps) => ps.map((p) => ({ ...p, removed: false })))}>
          Restore all
        </Button>
      )
    ) : (
      <>
        <Button variant="secondary" size="sm" icon={ArrowDownUp} onClick={() => setPages((ps) => [...ps].reverse())}>
          Reverse
        </Button>
        {(reordered || removedCount > 0) && (
          <Button variant="ghost" size="sm" icon={Undo2} onClick={() => setPages((ps) => [...ps].sort((a, b) => a.index - b.index).map((p) => ({ ...p, removed: false })))}>
            Reset
          </Button>
        )}
      </>
    ));

  const hint =
    mode === 'rotate'
      ? rotatedCount
        ? `${pluralize(rotatedCount, 'page')} will be rotated`
        : 'Use the arrows on a page, or rotate all pages at once'
      : mode === 'delete'
        ? kept.length === 0
          ? 'At least one page must remain'
          : removedCount
            ? `${pluralize(removedCount, 'page')} will be deleted`
            : 'Tap the pages you want to delete'
        : 'Drag pages to reorder them';

  return (
    <ToolLayout
      tool={tool}
      accept={['pdf']}
      multiple={false}
      onFiles={(f) => load(f[0])}
      hasFiles={!!pdf || loading}
      run={run}
      onReset={reset}
      heading={pdf ? <PdfFileHeader file={pdf.file} pageCount={pdf.pageCount} /> : 'Opening PDF…'}
      toolbar={toolbar}
      action={{ label: cfg.action, icon: FileDown, onClick: save, disabled: !pdf || !changed || kept.length === 0, hint }}
    >
      {mode === 'organize' ? (
        <SortableGrid
          items={kept}
          onReorder={(next) => setPages([...next, ...pages.filter((p) => p.removed)])}
          className={thumbGridClass}
          itemLabel={(p, i) => `Position ${i + 1}: page ${p.index + 1}`}
          renderItem={(p, i, dragging) => (
            <PageThumb
              src={thumbs[p.index]}
              rotation={p.rotation}
              state={dragging ? 'dragging' : 'normal'}
              label={
                <>
                  {i + 1}
                  {p.index !== i && <span className="ml-1 font-normal text-slate-400">(was {p.index + 1})</span>}
                </>
              }
              footer={
                <button
                  {...noDrag}
                  onClick={() => patch(p.id, () => ({ removed: true }))}
                  disabled={kept.length <= 1}
                  className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                  aria-label={`Remove page ${p.index + 1}`}
                >
                  <X className="size-4" />
                </button>
              }
            />
          )}
        />
      ) : (
        <div className={thumbGridClass}>
          {pages.map((p) =>
            mode === 'rotate' ? (
              <PageThumb
                key={p.id}
                src={thumbs[p.index]}
                rotation={p.rotation}
                state={p.rotation ? 'selected' : 'normal'}
                label={p.index + 1}
                footer={
                  <span className="flex">
                    <button
                      onClick={() => patch(p.id, (x) => ({ rotation: (x.rotation + 270) % 360 }))}
                      className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                      aria-label={`Rotate page ${p.index + 1} left`}
                    >
                      <RotateCcw className="size-4" />
                    </button>
                    <button
                      onClick={() => patch(p.id, (x) => ({ rotation: (x.rotation + 90) % 360 }))}
                      className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                      aria-label={`Rotate page ${p.index + 1} right`}
                    >
                      <RotateCw className="size-4" />
                    </button>
                  </span>
                }
              />
            ) : (
              <PageThumb
                key={p.id}
                src={thumbs[p.index]}
                state={p.removed ? 'removed' : 'normal'}
                label={p.index + 1}
                onClick={() => patch(p.id, (x) => ({ removed: !x.removed }))}
                ariaLabel={`${p.removed ? 'Keep' : 'Delete'} page ${p.index + 1}`}
                overlay={
                  <span
                    className={`absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full shadow-sm transition ${
                      p.removed ? 'bg-rose-600 text-white' : 'bg-white/90 text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:bg-slate-800'
                    }`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </span>
                }
                footer={p.removed && <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Delete</span>}
              />
            ),
          )}
        </div>
      )}
    </ToolLayout>
  );
}
