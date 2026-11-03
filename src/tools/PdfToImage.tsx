import { useMemo, useState } from 'react';
import { ImageDown } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { PageThumb, PdfFileHeader, thumbGridClass } from '../components/tool/PageThumb';
import { Field, Segmented, Slider } from '../components/ui/controls';
import { baseName, pluralize, type OutputFile } from '../lib/files';
import { canvasToBlob, releaseCanvas, type ImageMime } from '../lib/image';
import { parseRanges, renderPage } from '../lib/pdf';
import { getTool } from '../lib/tools';

type Format = 'jpg' | 'png';
type Dpi = '72' | '150' | '300';

export default function PdfToImage({ format: initialFormat }: { format: Format }) {
  const tool = getTool(initialFormat === 'png' ? 'pdf-to-png' : 'pdf-to-jpg');
  const { pdf, thumbs, loading, load, reset } = usePdfDoc();
  const run = useToolRun(tool.id);
  const [format, setFormat] = useState<Format>(initialFormat);
  const [dpi, setDpi] = useState<Dpi>('150');
  const [quality, setQuality] = useState(90);
  const [scope, setScope] = useState<'all' | 'custom'>('all');
  const [ranges, setRanges] = useState('');
  const count = pdf?.pageCount ?? 0;

  const pages = useMemo<number[] | string>(() => {
    if (scope === 'all') return Array.from({ length: count }, (_, i) => i);
    if (!ranges.trim()) return [];
    const parsed = parseRanges(ranges, count);
    return typeof parsed === 'string' ? parsed : [...new Set(parsed.flat())];
  }, [scope, ranges, count]);
  const error = typeof pages === 'string' ? pages : null;
  const list = Array.isArray(pages) ? pages : [];
  const selected = new Set(list);

  const convert = () => {
    if (!pdf) return;
    const mime: ImageMime = format === 'png' ? 'image/png' : 'image/jpeg';
    run.start(async (report) => {
      const base = baseName(pdf.file.name);
      const outputs: OutputFile[] = [];
      for (let i = 0; i < list.length; i++) {
        const n = list[i] + 1;
        report(i / list.length, `Converting page ${n} (${i + 1} of ${list.length})…`);
        const page = await pdf.doc.getPage(n);
        const canvas = await renderPage(page, Number(dpi) / 72);
        outputs.push({ name: `${base}-page-${String(n).padStart(String(count).length, '0')}.${format}`, blob: await canvasToBlob(canvas, mime, quality / 100) });
        releaseCanvas(canvas);
        page.cleanup();
      }
      return { outputs, zipName: `${base}-${format}.zip`, title: `${pluralize(outputs.length, 'image')} created!` };
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
      onReset={() => {
        reset();
        setRanges('');
      }}
      heading={pdf ? <PdfFileHeader file={pdf.file} pageCount={pdf.pageCount} /> : 'Opening PDF…'}
      action={{
        label: `Convert to ${format.toUpperCase()}`,
        icon: ImageDown,
        onClick: convert,
        disabled: !pdf || !!error || !list.length,
        hint: error ?? (list.length ? `${pluralize(list.length, 'page')} will be converted` : 'Select pages to convert'),
      }}
      settings={
        <>
          <Segmented label="Image format" value={format} onChange={setFormat} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
          <Segmented
            label="Resolution"
            value={dpi}
            onChange={setDpi}
            options={[
              { value: '72', label: 'Low', description: '72 dpi' },
              { value: '150', label: 'Medium', description: '150 dpi' },
              { value: '300', label: 'High', description: '300 dpi' },
            ]}
          />
          {format === 'jpg' && <Slider label="JPG quality" value={quality} min={40} max={100} onChange={setQuality} format={(v) => `${v}%`} />}
          <Segmented label="Pages" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All pages' }, { value: 'custom', label: 'Select pages' }]} />
          {scope === 'custom' && (
            <Field label="Page ranges" htmlFor="pages" hint={error ? <span className="text-rose-600 dark:text-rose-400">{error}</span> : 'e.g. 1-3, 5'}>
              <input id="pages" className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 5" />
            </Field>
          )}
        </>
      }
    >
      <div className={thumbGridClass}>
        {Array.from({ length: count }, (_, i) => (
          <PageThumb key={i} src={thumbs[i]} label={i + 1} state={scope === 'custom' && selected.has(i) ? 'selected' : 'normal'} />
        ))}
      </div>
    </ToolLayout>
  );
}
