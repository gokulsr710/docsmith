import { useState } from 'react';
import { Lock, Scaling, Unlock } from 'lucide-react';
import { ImageBatchTool } from '../components/tool/ImageBatchTool';
import { NumberInput, Segmented, Slider } from '../components/ui/controls';
import { baseName, formatBytes } from '../lib/files';
import { MIME_EXT, canvasToBlob, drawImage, mimeForFile, releaseCanvas } from '../lib/image';
import type { ImageItem } from '../components/tool/useImageItems';
import { getTool } from '../lib/tools';

type Mode = 'percent' | 'pixels';

export default function ResizeImage() {
  const tool = getTool('resize-image');
  const [mode, setMode] = useState<Mode>('percent');
  const [percent, setPercent] = useState(50);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [keepRatio, setKeepRatio] = useState(true);

  const target = (item: ImageItem) => {
    if (mode === 'percent') return { w: Math.max(1, Math.round((item.width * percent) / 100)), h: Math.max(1, Math.round((item.height * percent) / 100)) };
    if (!keepRatio) return { w: width, h: height };
    // Fit within the box while keeping the original aspect ratio.
    const s = Math.min(width / item.width, height / item.height);
    return { w: Math.max(1, Math.round(item.width * s)), h: Math.max(1, Math.round(item.height * s)) };
  };

  const invalid = mode === 'pixels' && (!width || !height);

  return (
    <ImageBatchTool
      tool={tool}
      accept={['image']}
      actionLabel="Resize images"
      actionIcon={Scaling}
      zipName="resized-images.zip"
      disabled={invalid}
      hint={invalid ? 'Enter a width and height' : undefined}
      resultTitle={(o) => (o.length > 1 ? 'Your images are resized!' : 'Your image is resized!')}
      caption={(item) => {
        const t = target(item);
        return (
          <>
            {item.width}×{item.height} → <span className="font-semibold text-brand-600 dark:text-brand-400">{t.w}×{t.h}</span> · {formatBytes(item.file.size)}
          </>
        );
      }}
      process={async (item, img) => {
        const t = target(item);
        const mime = mimeForFile(item.file);
        const canvas = drawImage(img, { width: t.w, height: t.h, background: mime === 'image/jpeg' ? '#ffffff' : null });
        const { width: w, height: h } = canvas;
        const blob = await canvasToBlob(canvas, mime, 0.92);
        releaseCanvas(canvas);
        return { name: `${baseName(item.file.name)}-${w}x${h}.${MIME_EXT[mime]}`, blob };
      }}
      settings={
        <>
          <Segmented label="Resize by" value={mode} onChange={setMode} options={[{ value: 'percent', label: 'Percentage' }, { value: 'pixels', label: 'Pixels' }]} />
          {mode === 'percent' ? (
            <Slider label="Scale" value={percent} min={5} max={200} step={5} onChange={setPercent} format={(v) => `${v}%`} hint={percent > 100 ? 'Upscaling can make images look blurry.' : undefined} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Width" value={width} onChange={setWidth} max={10000} suffix="px" />
                <NumberInput label="Height" value={height} onChange={setHeight} max={10000} suffix="px" />
              </div>
              <button
                type="button"
                onClick={() => setKeepRatio((k) => !k)}
                aria-pressed={keepRatio}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm dark:border-white/10"
              >
                {keepRatio ? <Lock className="size-4 text-brand-600" /> : <Unlock className="size-4 text-slate-400" />}
                <span className="flex-1">
                  <span className="block font-medium">{keepRatio ? 'Keep aspect ratio' : 'Stretch to exact size'}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{keepRatio ? 'Images fit inside the width × height box.' : 'Images may look distorted.'}</span>
                </span>
              </button>
            </>
          )}
        </>
      }
    />
  );
}
