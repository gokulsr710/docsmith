import { useState } from 'react';
import { Repeat } from 'lucide-react';
import { ImageBatchTool } from '../components/tool/ImageBatchTool';
import { Slider } from '../components/ui/controls';
import { baseName, type AcceptKind } from '../lib/files';
import { MIME_EXT, MIME_LABEL, canvasToBlob, drawImage, releaseCanvas, type ImageMime } from '../lib/image';
import { getTool } from '../lib/tools';

const PRESETS: Record<string, { from: AcceptKind; to: ImageMime }> = {
  'jpg-to-png': { from: 'jpg', to: 'image/png' },
  'png-to-jpg': { from: 'png', to: 'image/jpeg' },
  'webp-to-jpg': { from: 'webp', to: 'image/jpeg' },
  'webp-to-png': { from: 'webp', to: 'image/png' },
};

export default function ConvertImage({ preset }: { preset: keyof typeof PRESETS }) {
  const tool = getTool(preset);
  const { from, to } = PRESETS[preset];
  const [quality, setQuality] = useState(92);
  const [background, setBackground] = useState('#ffffff');
  const isJpg = to === 'image/jpeg';

  return (
    <ImageBatchTool
      key={preset}
      tool={tool}
      accept={[from]}
      actionLabel={`Convert to ${MIME_LABEL[to]}`}
      actionIcon={Repeat}
      zipName={`converted-${MIME_EXT[to]}.zip`}
      resultTitle={(o) => (o.length > 1 ? `${o.length} images converted!` : 'Your image is converted!')}
      process={async (item, img) => {
        const canvas = drawImage(img, { background: isJpg ? background : null });
        const blob = await canvasToBlob(canvas, to, isJpg ? quality / 100 : undefined);
        releaseCanvas(canvas);
        return { name: `${baseName(item.file.name)}.${MIME_EXT[to]}`, blob };
      }}
      settings={
        isJpg ? (
          <>
            <Slider label="JPG quality" value={quality} min={40} max={100} onChange={setQuality} format={(v) => `${v}%`} hint="Higher quality means a larger file." />
            <div>
              <label htmlFor="bg" className="label">
                Background for transparent areas
              </label>
              <div className="flex items-center gap-3">
                <input id="bg" type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/5" />
                <span className="text-sm text-slate-500 uppercase tabular-nums">{background}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">JPG doesn’t support transparency.</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">PNG is lossless — your images are converted at full quality, and transparency is preserved.</p>
        )
      }
    />
  );
}
