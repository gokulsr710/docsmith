import { useState } from 'react';
import { ArrowDownAZ, FileDown, RectangleHorizontal, RectangleVertical, RotateCcw, RotateCw, Sparkles, X } from 'lucide-react';
import { ToolLayout, useFileIntake } from '../components/tool/ToolLayout';
import { useToolRun, type Report } from '../components/tool/useToolRun';
import { useImageItems, type ImageItem } from '../components/tool/useImageItems';
import { SortableGrid, noDrag } from '../components/ui/SortableGrid';
import { Dropzone } from '../components/ui/Dropzone';
import { Button } from '../components/ui/Button';
import { Field, Segmented } from '../components/ui/controls';
import { acceptAttr, baseName, formatBytes, nextFrame, pluralize } from '../lib/files';
import { canvasToBlob, drawImage, jpegOrientation, loadImage, mimeForFile, releaseCanvas } from '../lib/image';
import { pdfBlob } from '../lib/pdf';
import { getTool } from '../lib/tools';

type PageSize = 'a4' | 'letter' | 'original';
type Orientation = 'auto' | 'portrait' | 'landscape';
type Margin = 'none' | 'small' | 'large';
type Fit = 'contain' | 'cover';

interface Settings {
  pageSize: PageSize;
  orientation: Orientation;
  margin: Margin;
  fit: Fit;
}

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGINS: Record<Margin, number> = { none: 0, small: 20, large: 40 };
/** CSS pixels → PDF points (96 dpi → 72 dpi). */
const PX_TO_PT = 0.75;

function rotatedSize(item: ImageItem) {
  const swap = item.rotation % 180 !== 0;
  return swap ? { w: item.height, h: item.width } : { w: item.width, h: item.height };
}

function pageSize(item: ImageItem, s: Settings) {
  const img = rotatedSize(item);
  const m = MARGINS[s.margin];
  if (s.pageSize === 'original') return { w: img.w * PX_TO_PT + 2 * m, h: img.h * PX_TO_PT + 2 * m };
  const [pw, ph] = PAGE_SIZES[s.pageSize];
  const landscape = s.orientation === 'landscape' || (s.orientation === 'auto' && img.w > img.h);
  return landscape ? { w: ph, h: pw } : { w: pw, h: ph };
}

async function buildPdf(items: ImageItem[], s: Settings, report: Report) {
  const { PDFDocument, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setProducer('Docsmith');
  pdf.setCreator('Docsmith Image to PDF');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    report(i / items.length, `Adding image ${i + 1} of ${items.length}…`);
    await nextFrame();

    const mime = mimeForFile(item.file);
    const bytes = new Uint8Array(await item.file.arrayBuffer());
    let embedded;
    // Embed original bytes when possible: lossless and much faster than re-encoding.
    if (item.rotation === 0 && mime === 'image/jpeg' && jpegOrientation(bytes) === 1) {
      embedded = await pdf.embedJpg(bytes).catch(() => null);
    } else if (item.rotation === 0 && mime === 'image/png') {
      embedded = await pdf.embedPng(bytes).catch(() => null);
    }
    if (!embedded) {
      const img = await loadImage(item.file);
      const keepAlpha = mime !== 'image/jpeg';
      const canvas = drawImage(img, { rotation: item.rotation, background: keepAlpha ? null : '#ffffff' });
      const blob = await canvasToBlob(canvas, keepAlpha ? 'image/png' : 'image/jpeg', 0.92);
      releaseCanvas(canvas);
      const data = new Uint8Array(await blob.arrayBuffer());
      embedded = keepAlpha ? await pdf.embedPng(data) : await pdf.embedJpg(data);
    }

    const { w, h } = pageSize(item, s);
    const page = pdf.addPage([w, h]);
    const m = MARGINS[s.margin];
    const boxW = w - 2 * m;
    const boxH = h - 2 * m;
    const iw = embedded.width;
    const ih = embedded.height;
    const scale = s.pageSize === 'original' ? boxW / iw : s.fit === 'cover' ? Math.max(boxW / iw, boxH / ih) : Math.min(boxW / iw, boxH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const x = m + (boxW - dw) / 2;
    const y = m + (boxH - dh) / 2;

    if (s.fit === 'cover' && s.pageSize !== 'original') {
      page.pushOperators(pushGraphicsState(), rectangle(m, m, boxW, boxH), clip(), endPath());
      page.drawImage(embedded, { x, y, width: dw, height: dh });
      page.pushOperators(popGraphicsState());
    } else {
      page.drawImage(embedded, { x, y, width: dw, height: dh });
    }
  }

  report(0.97, 'Saving PDF…');
  await nextFrame();
  return pdfBlob(await pdf.save());
}

export default function ImageToPdf() {
  const tool = getTool('image-to-pdf');
  const images = useImageItems();
  const run = useToolRun(tool.id);
  const [settings, setSettings] = useState<Settings>({ pageSize: 'a4', orientation: 'auto', margin: 'small', fit: 'contain' });
  const [fileName, setFileName] = useState('');
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const { items } = images;
  const intake = useFileIntake(['image'], (f) => images.add(f));
  const totalSize = items.reduce((sum, i) => sum + i.file.size, 0);

  const convert = () => {
    const name = (fileName.trim() || (items.length === 1 ? baseName(items[0].file.name) : 'images')).replace(/[\\/:*?"<>|]+/g, '-');
    run.start(async (report) => {
      const blob = await buildPdf(items, settings, report);
      return {
        outputs: [{ name: `${name}.pdf`, blob }],
        zipName: `${name}.zip`,
        title: 'Your PDF is ready!',
        message: `${pluralize(items.length, 'page')} · ${formatBytes(blob.size)}`,
      };
    });
  };

  const reset = () => {
    images.clear();
    setFileName('');
  };

  const settingsPanel = (
    <>
      <Segmented
        label="Page size"
        value={settings.pageSize}
        onChange={(v) => set('pageSize', v)}
        options={[
          { value: 'a4', label: 'A4' },
          { value: 'letter', label: 'Letter' },
          { value: 'original', label: 'Original' },
        ]}
        hint={settings.pageSize === 'original' ? 'Each page matches its image size.' : undefined}
      />
      {settings.pageSize !== 'original' && (
        <>
          <Segmented
            label="Orientation"
            value={settings.orientation}
            onChange={(v) => set('orientation', v)}
            options={[
              { value: 'auto', label: 'Auto', icon: Sparkles },
              { value: 'portrait', label: 'Portrait', icon: RectangleVertical },
              { value: 'landscape', label: 'Landscape', icon: RectangleHorizontal },
            ]}
            columns={3}
            hint={settings.orientation === 'auto' ? 'Matches each image’s orientation.' : undefined}
          />
          <Segmented
            label="Fit mode"
            value={settings.fit}
            onChange={(v) => set('fit', v)}
            options={[
              { value: 'contain', label: 'Fit', description: 'Show whole image' },
              { value: 'cover', label: 'Fill', description: 'Fill page, crop edges' },
            ]}
          />
        </>
      )}
      <Segmented
        label="Margin"
        value={settings.margin}
        onChange={(v) => set('margin', v)}
        options={[
          { value: 'none', label: 'None' },
          { value: 'small', label: 'Small' },
          { value: 'large', label: 'Large' },
        ]}
      />
      <Field label="File name" htmlFor="pdf-name">
        <div className="relative">
          <input
            id="pdf-name"
            className="input pr-12"
            placeholder={items.length === 1 ? baseName(items[0].file.name) : 'images'}
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            maxLength={120}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">.pdf</span>
        </div>
      </Field>
    </>
  );

  return (
    <ToolLayout
      tool={tool}
      accept={['image']}
      onFiles={(f) => images.add(f)}
      hasFiles={items.length > 0 || images.loading}
      run={run}
      onReset={reset}
      settings={settingsPanel}
      heading={
        <span>
          {pluralize(items.length, 'image')} <span className="font-normal text-slate-400">· {formatBytes(totalSize)}</span>
        </span>
      }
      toolbar={
        items.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowDownAZ}
            onClick={() => images.setItems([...items].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))}
          >
            Sort A–Z
          </Button>
        )
      }
      action={{
        label: 'Convert to PDF',
        icon: FileDown,
        onClick: convert,
        disabled: !items.length || images.loading,
        hint: items.length > 1 ? 'Drag images to change page order' : undefined,
      }}
    >
      <SortableGrid
        items={items}
        onReorder={images.setItems}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4"
        itemLabel={(item, i) => `Page ${i + 1}: ${item.file.name}`}
        renderItem={(item, index, dragging) => (
          <ImageCard
            item={item}
            index={index}
            settings={settings}
            dragging={dragging}
            onRotate={(d) => images.update(item.id, { rotation: (item.rotation + d + 360) % 360 })}
            onRemove={() => images.remove(item.id)}
          />
        )}
        trailing={<Dropzone compact accept={acceptAttr(['image'])} onFiles={intake} />}
      />
      {images.loading && <p className="mt-4 text-sm text-slate-500">Loading images…</p>}
    </ToolLayout>
  );
}

function ImageCard({
  item,
  index,
  settings,
  dragging,
  onRotate,
  onRemove,
}: {
  item: ImageItem;
  index: number;
  settings: Settings;
  dragging: boolean;
  onRotate: (deg: number) => void;
  onRemove: () => void;
}) {
  const page = pageSize(item, settings);
  const m = MARGINS[settings.margin];
  const box = { w: page.w - 2 * m, h: page.h - 2 * m };
  const swap = item.rotation % 180 !== 0;
  const fit = settings.pageSize === 'original' ? 'contain' : settings.fit;

  return (
    <div
      className={`group card flex h-full flex-col p-2 transition-shadow sm:p-3 ${dragging ? 'scale-[1.03] shadow-lift ring-2 ring-brand-500' : 'hover:shadow-lift'}`}
    >
      <div className="relative flex aspect-square items-center justify-center rounded-xl bg-slate-100 p-3 dark:bg-white/5">
        {/* Live page preview: frame matches the PDF page, image placed with margin and fit mode. */}
        <div
          className="relative max-h-full max-w-full bg-white shadow-md ring-1 ring-slate-900/5"
          style={{ aspectRatio: `${page.w} / ${page.h}`, width: page.w >= page.h ? '100%' : 'auto', height: page.h > page.w ? '100%' : 'auto' }}
        >
          <div className="absolute overflow-hidden" style={{ inset: `${(m / page.h) * 100}% ${(m / page.w) * 100}%` }}>
            <img
              src={item.url}
              alt={item.file.name}
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none select-none"
              style={{
                width: swap ? `${(box.h / box.w) * 100}%` : '100%',
                height: swap ? `${(box.w / box.h) * 100}%` : '100%',
                objectFit: fit,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                transition: 'transform 200ms',
              }}
            />
          </div>
        </div>
        <span className="absolute top-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900/80 px-1.5 text-xs font-semibold text-white tabular-nums">
          {index + 1}
        </span>
        <button
          {...noDrag}
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:bg-slate-800 dark:text-slate-300"
          aria-label={`Remove ${item.file.name}`}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-xs font-medium sm:text-sm" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            {item.width}×{item.height} · {formatBytes(item.file.size)}
          </p>
        </div>
        <button {...noDrag} onClick={() => onRotate(-90)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Rotate left">
          <RotateCcw className="size-4" />
        </button>
        <button {...noDrag} onClick={() => onRotate(90)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Rotate right">
          <RotateCw className="size-4" />
        </button>
      </div>
    </div>
  );
}
