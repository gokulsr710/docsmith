import { useState } from 'react';
import { Shrink } from 'lucide-react';
import { ImageBatchTool } from '../components/tool/ImageBatchTool';
import { NumberInput, Segmented, Slider, Toggle } from '../components/ui/controls';
import { baseName } from '../lib/files';
import { MIME_EXT, canvasToBlob, drawImage, mimeForFile, releaseCanvas, supportsWebpExport, type ImageMime } from '../lib/image';
import { getTool } from '../lib/tools';

type Output = 'keep' | 'jpg' | 'webp';

export default function CompressImage() {
  const tool = getTool('compress-image');
  const [quality, setQuality] = useState(70);
  const [output, setOutput] = useState<Output>('keep');
  const [limit, setLimit] = useState(false);
  const [maxSide, setMaxSide] = useState(2048);
  const webp = supportsWebpExport();

  return (
    <ImageBatchTool
      tool={tool}
      accept={['image']}
      actionLabel="Compress images"
      actionIcon={Shrink}
      zipName="compressed-images.zip"
      compare
      resultTitle={(o) => (o.length > 1 ? 'Your images are compressed!' : 'Your image is compressed!')}
      process={async (item, img) => {
        const source = mimeForFile(item.file);
        let mime: ImageMime = output === 'jpg' ? 'image/jpeg' : output === 'webp' ? 'image/webp' : source;
        // Canvas PNG export is lossless, so "keep" for PNG would never shrink the
        // file meaningfully: use WEBP (keeps transparency) when available.
        if (mime === 'image/png') mime = webp ? 'image/webp' : 'image/jpeg';
        if (mime === 'image/webp' && !webp) mime = 'image/jpeg';

        let { width, height } = { width: item.width, height: item.height };
        if (limit && Math.max(width, height) > maxSide) {
          const s = maxSide / Math.max(width, height);
          width = Math.round(width * s);
          height = Math.round(height * s);
        }
        const canvas = drawImage(img, { width, height, background: mime === 'image/jpeg' ? '#ffffff' : null });
        const blob = await canvasToBlob(canvas, mime, quality / 100);
        releaseCanvas(canvas);
        // Never return a file bigger than the original.
        if (blob.size >= item.file.size && output === 'keep') return { name: item.file.name, blob: item.file };
        return { name: `${baseName(item.file.name)}-compressed.${MIME_EXT[mime]}`, blob };
      }}
      hint={output === 'keep' ? 'PNG files are saved as WEBP for real size savings' : undefined}
      settings={
        <>
          <Slider
            label="Quality"
            value={quality}
            min={10}
            max={95}
            step={5}
            onChange={setQuality}
            format={(v) => `${v}%`}
            hint={quality >= 80 ? 'High quality · moderate savings' : quality >= 55 ? 'Balanced · recommended' : 'Maximum savings · visible artifacts possible'}
          />
          <Segmented
            label="Output format"
            value={output}
            onChange={setOutput}
            options={[
              { value: 'keep', label: 'Original' },
              { value: 'jpg', label: 'JPG' },
              ...(webp ? [{ value: 'webp' as const, label: 'WEBP' }] : []),
            ]}
          />
          <Toggle label="Limit dimensions" description="Downscale very large photos for extra savings." checked={limit} onChange={setLimit} />
          {limit && <NumberInput label="Longest side" value={maxSide} onChange={setMaxSide} min={64} max={10000} suffix="px" />}
        </>
      }
    />
  );
}
