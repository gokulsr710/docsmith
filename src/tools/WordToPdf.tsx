import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Printer, RectangleHorizontal, RectangleVertical, TriangleAlert } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/controls';
import { useToast } from '../context/toast';
import { baseName, errorMessage, formatBytes } from '../lib/files';
import { getTool } from '../lib/tools';
import { layoutDocx, layoutToPdf, printLayout, renderDocx, type DocxLayout, type PageOverride, type RenderedDocx } from '../lib/docxLayout';

type PageSize = 'auto' | 'A4' | 'LETTER';
type Orientation = 'portrait' | 'landscape';
type Margin = 'auto' | 'narrow' | 'normal' | 'wide';

const PX = 96 / 72; // points → CSS px
const PAGE_POINTS = { A4: [595.28, 841.89], LETTER: [612, 792] } as const;
const MARGIN_POINTS: Record<Exclude<Margin, 'auto'>, number> = { narrow: 36, normal: 72, wide: 108 };

function toOverride(size: PageSize, orientation: Orientation, margin: Margin): PageOverride {
  let s: PageOverride['size'] = null;
  if (size !== 'auto') {
    const [w, h] = PAGE_POINTS[size];
    s = orientation === 'landscape' ? { w: h * PX, h: w * PX } : { w: w * PX, h: h * PX };
  }
  return { size: s, margin: margin === 'auto' ? null : MARGIN_POINTS[margin] * PX };
}

function sizeLabel(w: number, h: number) {
  const pt = [w / PX, h / PX].map(Math.round);
  const portrait = pt[0] <= pt[1];
  const [a, b] = portrait ? pt : [pt[1], pt[0]];
  const name = Math.abs(a - 595) < 3 && Math.abs(b - 842) < 3 ? 'A4' : a === 612 && b === 792 ? 'Letter' : a === 612 && b === 1008 ? 'Legal' : `${(w / 96).toFixed(1)} × ${(h / 96).toFixed(1)} in`;
  return `${name} · ${portrait ? 'Portrait' : 'Landscape'}`;
}

/** Shows the laid-out pages exactly as they will appear in the PDF, scaled to fit. */
function PagesPreview({ layout }: { layout: DocxLayout }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const clones = useRef<{ outer: HTMLElement; page: HTMLElement; w: number; h: number }[]>([]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.replaceChildren();
    clones.current = layout.pages.map((p, i) => {
      const { w, h } = layout.sizes[i];
      const outer = document.createElement('div');
      outer.className = 'relative overflow-hidden bg-white shadow-md ring-1 ring-black/5';
      outer.setAttribute('role', 'img');
      outer.setAttribute('aria-label', `Page ${i + 1} of ${layout.pages.length}`);
      const page = p.cloneNode(true) as HTMLElement;
      page.style.transformOrigin = '0 0';
      page.style.position = 'absolute';
      page.style.left = '0';
      page.style.top = '0';
      outer.appendChild(page);
      el.appendChild(outer);
      return { outer, page, w, h };
    });
  }, [layout]);

  useEffect(() => {
    if (!width) return;
    for (const c of clones.current) {
      const scale = Math.min(1, width / c.w);
      c.outer.style.width = `${c.w * scale}px`;
      c.outer.style.height = `${c.h * scale}px`;
      c.page.style.transform = `scale(${scale})`;
    }
  }, [width, layout]);

  return <div ref={box} className="flex w-full flex-col items-center gap-4 sm:gap-6" />;
}

export default function WordToPdf() {
  const tool = getTool('word-to-pdf');
  const run = useToolRun(tool.id);
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<RenderedDocx | null>(null);
  const [layout, setLayout] = useState<DocxLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [laying, setLaying] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>('auto');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margin, setMargin] = useState<Margin>('auto');
  const override = useMemo(() => toOverride(pageSize, orientation, margin), [pageSize, orientation, margin]);

  // Dispose the hidden render of the previous file.
  useEffect(() => () => doc?.dispose(), [doc]);
  useEffect(() => () => layout?.dispose(), [layout]);

  // Lay the document out again whenever the page settings change.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLaying(true);
    const t = setTimeout(() => {
      try {
        const l = layoutDocx(doc, override);
        if (cancelled) l.dispose();
        else setLayout(l);
      } catch (e) {
        if (!cancelled) toast.error('Couldn’t lay out this document', errorMessage(e));
      } finally {
        if (!cancelled) setLaying(false);
      }
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [doc, override, toast]);

  const load = async (f: File) => {
    setFile(f);
    setDoc(null);
    setLayout(null);
    setLoading(true);
    try {
      setDoc(await renderDocx(f));
    } catch (e) {
      toast.error(`Couldn't open “${f.name}”`, errorMessage(e));
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setDoc(null);
    setLayout(null);
  };

  const convert = () => {
    if (!layout || !file) return;
    run.start(async (report) => {
      const blob = await layoutToPdf(layout, report, baseName(file.name));
      const name = `${baseName(file.name)}.pdf`;
      const pages = layout.pages.length;
      return {
        outputs: [{ name, blob }],
        zipName: `${baseName(file.name)}.zip`,
        title: 'Your PDF is ready!',
        message: `${name} · ${pages} page${pages === 1 ? '' : 's'} · ${formatBytes(blob.size)}`,
      };
    });
  };

  const notes: string[] = [];
  if (doc?.droppedImages) notes.push(`${doc.droppedImages} drawing${doc.droppedImages > 1 ? 's' : ''} in a format browsers can’t display (such as EMF/WMF) will be left out.`);
  const first = layout?.sizes[0];

  return (
    <ToolLayout
      tool={tool}
      accept={['docx']}
      multiple={false}
      onFiles={(f) => load(f[0])}
      hasFiles={!!file}
      run={run}
      onReset={reset}
      heading={
        file && (
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-brand-600" aria-hidden />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 font-normal text-slate-400">· {formatBytes(file.size)}</span>
          </span>
        )
      }
      action={{
        label: 'Convert to PDF',
        icon: FileText,
        onClick: convert,
        disabled: !layout || laying,
        hint: loading ? 'Reading document…' : laying ? 'Laying out pages…' : undefined,
      }}
      notice={
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Keeps the original layout: fonts, columns, spacing, tables, images, headers and footers. Text stays selectable.
        </p>
      }
      settings={
        <>
          <Segmented
            label="Page size"
            value={pageSize}
            onChange={setPageSize}
            options={[
              { value: 'auto', label: 'Original' },
              { value: 'A4', label: 'A4' },
              { value: 'LETTER', label: 'Letter' },
            ]}
          />
          {pageSize !== 'auto' && (
            <Segmented
              label="Orientation"
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: 'portrait', label: 'Portrait', icon: RectangleVertical },
                { value: 'landscape', label: 'Landscape', icon: RectangleHorizontal },
              ]}
            />
          )}
          <Segmented
            label="Margins"
            value={margin}
            onChange={setMargin}
            options={[
              { value: 'auto', label: 'Original' },
              { value: 'narrow', label: 'Narrow', description: '0.5 in' },
              { value: 'normal', label: 'Normal', description: '1 in' },
              { value: 'wide', label: 'Wide', description: '1.5 in' },
            ]}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">“Original” uses the page size and margins saved in the Word file, so the PDF matches the document.</p>
          {layout && doc && (
            <div>
              <Button variant="secondary" icon={Printer} className="w-full" onClick={() => printLayout(layout, doc)}>
                Print / Save as PDF
              </Button>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Uses your browser’s print dialog. Best for Hindi, Tamil, Arabic, Chinese and other non-Latin text.</p>
            </div>
          )}
        </>
      }
    >
      {doc?.complexScript && (
        <div className="mb-4 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            This document contains characters (for example Hindi, Tamil, Arabic or Chinese) that the built-in PDF fonts can’t draw. Use <strong>Print / Save as PDF</strong>{' '}
            in the settings for a correct result.
          </p>
        </div>
      )}
      {notes.map((n) => (
        <p key={n} className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {n}
        </p>
      ))}
      <div className="card overflow-hidden bg-slate-100 dark:bg-white/5">
        <p className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400" aria-live="polite">
          {laying && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {layout && first
            ? `Preview · ${layout.pages.length} page${layout.pages.length === 1 ? '' : 's'} · ${sizeLabel(first.w, first.h)}`
            : loading
              ? 'Reading document…'
              : 'Preview'}
        </p>
        <div className="max-h-[75vh] overflow-y-auto p-3 sm:p-6">
          {layout ? (
            <PagesPreview layout={layout} />
          ) : (
            <div className="mx-auto aspect-[1/1.294] max-w-[560px] animate-pulse rounded bg-white/70 dark:bg-white/10" />
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
