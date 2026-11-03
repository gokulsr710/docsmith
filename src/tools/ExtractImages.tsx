import { useState } from 'react';
import { FileOutput } from 'lucide-react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { PageThumb, PdfFileHeader, thumbGridClass } from '../components/tool/PageThumb';
import { NumberInput, Segmented } from '../components/ui/controls';
import { baseName, pluralize, type OutputFile } from '../lib/files';
import { canvasToBlob, releaseCanvas, type ImageMime } from '../lib/image';
import { getPdfjs } from '../lib/pdf';
import { getTool } from '../lib/tools';

interface PdfImageObject {
  width: number;
  height: number;
  data?: Uint8ClampedArray;
  kind?: number;
  bitmap?: ImageBitmap;
}

/** Resolves a PDF.js image object by name, giving up after a timeout. */
function getObject(page: PDFPageProxy, name: string): Promise<PdfImageObject | null> {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    try {
      store.get(name, (obj: PdfImageObject) => {
        clearTimeout(timer);
        resolve(obj ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Converts a decoded PDF.js image into a canvas. kind: 1 = 1-bit grayscale, 2 = RGB, 3 = RGBA. */
function toCanvas(obj: PdfImageObject): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = obj.width;
  canvas.height = obj.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (obj.bitmap) {
    ctx.drawImage(obj.bitmap, 0, 0);
    return canvas;
  }
  if (!obj.data) return null;
  const out = ctx.createImageData(obj.width, obj.height);
  const px = obj.width * obj.height;
  const src = obj.data;
  if (obj.kind === 3) {
    out.data.set(src.subarray(0, px * 4));
  } else if (obj.kind === 2) {
    for (let i = 0, j = 0; i < px; i++, j += 3) {
      out.data[i * 4] = src[j];
      out.data[i * 4 + 1] = src[j + 1];
      out.data[i * 4 + 2] = src[j + 2];
      out.data[i * 4 + 3] = 255;
    }
  } else if (obj.kind === 1) {
    const rowBytes = (obj.width + 7) >> 3;
    for (let y = 0; y < obj.height; y++) {
      for (let x = 0; x < obj.width; x++) {
        const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const o = (y * obj.width + x) * 4;
        out.data[o] = out.data[o + 1] = out.data[o + 2] = bit ? 255 : 0;
        out.data[o + 3] = 255;
      }
    }
  } else {
    return null;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

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
          const obj = await getObject(page, name);
          if (!obj || obj.width < minSize || obj.height < minSize) continue;
          const canvas = toCanvas(obj);
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
