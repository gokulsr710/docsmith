import { useState } from 'react';
import { FileText, Minimize2 } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { Segmented } from '../components/ui/controls';
import { baseName, formatBytes, nextFrame, pluralize } from '../lib/files';
import { canvasToBlob, releaseCanvas } from '../lib/image';
import { loadPdfLib, pdfBlob, renderPage } from '../lib/pdf';
import { getTool } from '../lib/tools';

type Level = 'basic' | 'recommended' | 'extreme';

/** Raster settings for the image-based levels. */
const RASTER: Record<Exclude<Level, 'basic'>, { dpi: number; quality: number }> = {
  recommended: { dpi: 120, quality: 0.65 },
  extreme: { dpi: 80, quality: 0.45 },
};

export default function CompressPdf() {
  const tool = getTool('compress-pdf');
  const { pdf, loading, load, reset } = usePdfDoc({ thumbnails: false });
  const run = useToolRun(tool.id);
  const [level, setLevel] = useState<Level>('recommended');

  const compress = () => {
    if (!pdf) return;
    run.start(async (report) => {
      let blob: Blob;
      if (level === 'basic') {
        // Lossless: re-serialise with object streams, dropping unused objects and metadata bloat.
        report(0.2, 'Optimizing document structure…');
        await nextFrame();
        const doc = await loadPdfLib(pdf.bytes);
        report(0.6, 'Saving…');
        blob = pdfBlob(await doc.save({ useObjectStreams: true }));
      } else {
        const { dpi, quality } = RASTER[level];
        const { PDFDocument } = await import('pdf-lib');
        const out = await PDFDocument.create();
        for (let i = 1; i <= pdf.pageCount; i++) {
          report((i - 1) / pdf.pageCount, `Compressing page ${i} of ${pdf.pageCount}…`);
          const page = await pdf.doc.getPage(i);
          const size = page.getViewport({ scale: 1 });
          const canvas = await renderPage(page, dpi / 72);
          const jpg = await canvasToBlob(canvas, 'image/jpeg', quality);
          releaseCanvas(canvas);
          page.cleanup();
          const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
          out.addPage([size.width, size.height]).drawImage(img, { x: 0, y: 0, width: size.width, height: size.height });
        }
        report(0.97, 'Saving…');
        blob = pdfBlob(await out.save());
      }

      const before = pdf.file.size;
      const smaller = blob.size < before;
      const name = smaller ? `${baseName(pdf.file.name)}-compressed.pdf` : pdf.file.name;
      return {
        outputs: [{ name, blob: smaller ? blob : new Blob([pdf.bytes], { type: 'application/pdf' }), originalSize: before }],
        zipName: `${baseName(name)}.zip`,
        title: smaller ? 'Your PDF is compressed!' : 'Already well optimized',
        compare: { before, after: smaller ? blob.size : before },
        note: smaller
          ? level !== 'basic'
            ? 'Pages were converted to images to save space, so text in this copy can’t be selected or searched.'
            : undefined
          : `This PDF couldn’t be made smaller at the “${level}” level, so your original file is returned unchanged.${level !== 'extreme' ? ' Try a stronger level.' : ''}`,
      };
    });
  };

  return (
    <ToolLayout
      tool={tool}
      accept={['pdf']}
      multiple={false}
      onFiles={(f) => load(f[0])}
      hasFiles={!!pdf || loading}
      run={run}
      onReset={reset}
      heading="Selected file"
      action={{ label: 'Compress PDF', icon: Minimize2, onClick: compress, disabled: !pdf }}
      settings={
        <Segmented
          label="Compression level"
          value={level}
          onChange={setLevel}
          columns={1}
          options={[
            { value: 'basic', label: 'Basic', description: 'Lossless · keeps text selectable' },
            { value: 'recommended', label: 'Recommended', description: 'Good quality, much smaller (120 dpi)' },
            { value: 'extreme', label: 'Extreme', description: 'Smallest size, lower quality (80 dpi)' },
          ]}
          hint="Recommended and Extreme rasterize pages, which works best for scanned documents and image-heavy PDFs."
        />
      }
    >
      {pdf ? (
        <div className="card flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <FileText className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{pdf.file.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {pluralize(pdf.pageCount, 'page')} · {formatBytes(pdf.file.size)}
            </p>
          </div>
        </div>
      ) : (
        <div className="card h-20 animate-pulse" />
      )}
    </ToolLayout>
  );
}
