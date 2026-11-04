import { useState } from 'react';
import { FileText, Printer, RectangleHorizontal, RectangleVertical, TriangleAlert } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/controls';
import { useToast } from '../context/toast';
import { baseName, errorMessage, formatBytes } from '../lib/files';
import { getTool } from '../lib/tools';
import { htmlToPdf, printHtml, readDocx, type DocxContent, type PdfPageOptions } from '../lib/word';

type Margin = 'narrow' | 'normal' | 'wide';
const MARGINS: Record<Margin, number> = { narrow: 36, normal: 72, wide: 108 };
const MARGIN_LABEL: Record<Margin, string> = { narrow: '0.5 in', normal: '1 in', wide: '1.5 in' };
const PAGE_POINTS = { A4: [595.28, 841.89], LETTER: [612, 792] } as const;
const BODY_PT = 11;

/**
 * Scaled page preview that follows the PDF settings: the paper has the chosen
 * size and orientation, margins are drawn to scale, text is sized relative to
 * the page width so line wrapping roughly matches the PDF, and a faint line
 * marks where each page ends.
 */
function PagePreview({ html, opts }: { html: string; opts: PdfPageOptions }) {
  const [w, h] = PAGE_POINTS[opts.pageSize];
  const [pw, ph] = opts.orientation === 'landscape' ? [h, w] : [w, h];
  const pct = (v: number) => `${(v / pw) * 100}%`;
  const pageHeight = `${(ph / pw) * 100}cqw`;
  return (
    <div className="mx-auto" style={{ maxWidth: pw * 1.1, containerType: 'inline-size' }}>
      <div
        className="relative bg-white shadow-md"
        style={{
          aspectRatio: `${pw} / ${ph}`,
          backgroundImage: `linear-gradient(to bottom, transparent calc(100% - 1px), rgb(148 163 184 / 0.6) calc(100% - 1px))`,
          backgroundSize: `100% ${pageHeight}`,
          padding: pct(opts.margin),
        }}
      >
        <article
          className="docx-preview relative text-slate-900 outline-1 outline-sky-300/60 outline-dashed"
          style={{ fontSize: `${(BODY_PT / pw) * 100}cqw`, lineHeight: 1.35, overflowWrap: 'anywhere' }}
          aria-label="Document preview"
          // Sanitized in readDocx: no scripts, event handlers or unsafe links.
          dangerouslySetInnerHTML={{ __html: html || '<p><em>This document appears to be empty.</em></p>' }}
        />
      </div>
    </div>
  );
}

export default function WordToPdf() {
  const tool = getTool('word-to-pdf');
  const run = useToolRun(tool.id);
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<DocxContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState<PdfPageOptions['pageSize']>('A4');
  const [orientation, setOrientation] = useState<PdfPageOptions['orientation']>('portrait');
  const [margin, setMargin] = useState<Margin>('normal');
  const opts: PdfPageOptions = { pageSize, orientation, margin: MARGINS[margin] };

  const load = async (f: File) => {
    setFile(f);
    setDoc(null);
    setLoading(true);
    try {
      setDoc(await readDocx(f));
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
  };

  const convert = () => {
    if (!doc || !file) return;
    run.start(async (report) => {
      report(0.2, 'Laying out pages…');
      const blob = await htmlToPdf(doc.html, opts);
      const name = `${baseName(file.name)}.pdf`;
      return { outputs: [{ name, blob }], zipName: `${baseName(file.name)}.zip`, title: 'Your PDF is ready!', message: `${name} · ${formatBytes(blob.size)}` };
    });
  };

  const notes: string[] = [];
  if (doc?.droppedImages) notes.push(`${doc.droppedImages} drawing${doc.droppedImages > 1 ? 's' : ''} in an unsupported format (such as EMF/WMF) will be left out.`);

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
            <FileText className="size-4 shrink-0 text-sky-600" aria-hidden />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 font-normal text-slate-400">· {formatBytes(file.size)}</span>
          </span>
        )
      }
      action={{ label: 'Convert to PDF', icon: FileText, onClick: convert, disabled: !doc, hint: loading ? 'Reading document…' : undefined }}
      notice={
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Text, headings, lists, tables, links and images are kept. Complex layouts (text boxes, columns, headers/footers) are simplified.
        </p>
      }
      settings={
        <>
          <Segmented label="Page size" value={pageSize} onChange={setPageSize} options={[{ value: 'A4', label: 'A4' }, { value: 'LETTER', label: 'Letter' }]} />
          <Segmented
            label="Orientation"
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: 'portrait', label: 'Portrait', icon: RectangleVertical },
              { value: 'landscape', label: 'Landscape', icon: RectangleHorizontal },
            ]}
          />
          <Segmented
            label="Margins"
            value={margin}
            onChange={setMargin}
            options={[
              { value: 'narrow', label: 'Narrow', description: '0.5 in' },
              { value: 'normal', label: 'Normal', description: '1 in' },
              { value: 'wide', label: 'Wide', description: '1.5 in' },
            ]}
          />
          {doc && (
            <div>
              <Button variant="secondary" icon={Printer} className="w-full" onClick={() => printHtml(doc.html, opts)}>
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
            This document contains characters (for example Hindi, Tamil, Arabic or Chinese) that the built-in PDF font can’t draw. Use <strong>Print / Save as PDF</strong>{' '}
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
        <p className="border-b border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400" aria-live="polite">
          Preview · {pageSize === 'A4' ? 'A4' : 'Letter'} · {orientation === 'portrait' ? 'Portrait' : 'Landscape'} · {MARGIN_LABEL[margin]} margins
        </p>
        <div className="max-h-[75vh] overflow-y-auto p-3 sm:p-6">
          {doc ? (
            <PagePreview html={doc.html} opts={opts} />
          ) : (
            <div className="mx-auto aspect-[1/1.414] max-w-[560px] animate-pulse rounded bg-white/70 dark:bg-white/10" />
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
