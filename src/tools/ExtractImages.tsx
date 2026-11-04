import { useState } from 'react';
import { FileOutput } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { PageThumb, PdfFileHeader, thumbGridClass } from '../components/tool/PageThumb';
import { NumberInput, Segmented } from '../components/ui/controls';
import { baseName, pluralize, type OutputFile } from '../lib/files';
import { canvasToBlob, releaseCanvas, type ImageMime } from '../lib/image';
import { getPdfjs } from '../lib/pdf';
import { getPdfImageObject, pdfImageToCanvas } from '../lib/pdfImages';
import { getTool } from '../lib/tools';

export default function ExtractImages() {
  const tool = getTool('extract-images');
  const { pdf, thumbs, loading, load, reset } = usePdfDoc();
  const run = useToolRun(tool.id);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [minSize, setMinSize] = useState(32);

  const extract = () => {
    if (!pdf) return;
    run.start(async (report) => {
      const { OPS } = await getPdfjs();
      const imageOps = new Set([OPS.paintImageXObject, OPS.paintImageXObjectRepeat]);
      const mime: ImageMime = format === 'png' ? 'image/png' : 'image/jpeg';
      const base = baseName(pdf.file.name);
      const outputs: OutputFile[] = [];
      const seen = new Set<string>();

      for (let p = 1; p <= pdf.pageCount; p++) {
        report((p - 1) / pdf.pageCount, `Scanning page ${p} of ${pdf.pageCount}…`);
        const page = await pdf.doc.getPage(p);
        const ops = await page.getOperatorList();
        let n = 0;
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (!imageOps.has(ops.fnArray[i])) continue;
          const name = ops.argsArray[i]?.[0];
          if (typeof name !== 'string' || seen.has(name)) continue;
          seen.add(name);
          const obj = await getPdfImageObject(page, name);
          if (!obj || obj.width < minSize || obj.height < minSize) continue;
          const canvas = pdfImageToCanvas(obj);
          if (!canvas) continue;
          if (mime === 'image/jpeg') {
            // Flatten transparency onto white for JPG.
            const flat = document.createElement('canvas');
            flat.width = canvas.width;
            flat.height = canvas.height;
            const fctx = flat.getContext('2d')!;
            fctx.fillStyle = '#fff';
            fctx.fillRect(0, 0, flat.width, flat.height);
            fctx.drawImage(canvas, 0, 0);
            releaseCanvas(canvas);
            outputs.push({ name: `${base}-p${p}-img${++n}.jpg`, blob: await canvasToBlob(flat, mime, 0.92) });
            releaseCanvas(flat);
          } else {
            outputs.push({ name: `${base}-p${p}-img${++n}.png`, blob: await canvasToBlob(canvas, mime) });
            releaseCanvas(canvas);
          }
        }
        page.cleanup();
      }
      if (!outputs.length) throw new Error(`No images${minSize > 1 ? ` larger than ${minSize}px` : ''} were found in this PDF. Text and vector graphics can’t be extracted as images — try “PDF to JPG” instead.`);
      return { outputs, zipName: `${base}-images.zip`, title: `${pluralize(outputs.length, 'image')} extracted!` };
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
      heading={pdf ? <PdfFileHeader file={pdf.file} pageCount={pdf.pageCount} /> : 'Opening PDF…'}
      action={{ label: 'Extract images', icon: FileOutput, onClick: extract, disabled: !pdf }}
      settings={
        <>
          <Segmented label="Save images as" value={format} onChange={setFormat} options={[{ value: 'png', label: 'PNG', description: 'Lossless' }, { value: 'jpg', label: 'JPG', description: 'Smaller' }]} />
          <NumberInput label="Skip images smaller than" value={minSize} onChange={setMinSize} min={1} max={2000} suffix="px" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Tiny images are usually icons, bullets or decorative elements.</p>
        </>
      }
    >
      <div className={thumbGridClass}>
        {Array.from({ length: pdf?.pageCount ?? 0 }, (_, i) => (
          <PageThumb key={i} src={thumbs[i]} label={i + 1} />
        ))}
      </div>
    </ToolLayout>
  );
}
