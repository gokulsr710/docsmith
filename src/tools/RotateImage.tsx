import { useState } from 'react';
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, RotateCcwSquare } from 'lucide-react';
import { ImageBatchTool } from '../components/tool/ImageBatchTool';
import { Button } from '../components/ui/Button';
import { baseName } from '../lib/files';
import { MIME_EXT, canvasToBlob, drawImage, mimeForFile, releaseCanvas } from '../lib/image';
import { getTool } from '../lib/tools';

export default function RotateImage() {
  const tool = getTool('rotate-image');
  const [rotation, setRotation] = useState(90);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const unchanged = rotation === 0 && !flipH && !flipV;

  return (
    <ImageBatchTool
      tool={tool}
      accept={['image']}
      actionLabel="Rotate images"
      actionIcon={RotateCcwSquare}
      zipName="rotated-images.zip"
      disabled={unchanged}
      hint={unchanged ? 'Choose a rotation or flip' : 'Applies to all images'}
      resultTitle={(o) => (o.length > 1 ? 'Your images are rotated!' : 'Your image is rotated!')}
      previewStyle={() => ({ transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`, ...(rotation % 180 ? { maxWidth: '75%', maxHeight: '75%' } : {}) })}
      process={async (item, img) => {
        const mime = mimeForFile(item.file);
        const canvas = drawImage(img, { rotation, flipH, flipV, background: mime === 'image/jpeg' ? '#ffffff' : null });
        const blob = await canvasToBlob(canvas, mime, 0.95);
        releaseCanvas(canvas);
        return { name: `${baseName(item.file.name)}-rotated.${MIME_EXT[mime]}`, blob };
      }}
      settings={
        <>
          <div>
            <p className="label">Rotation</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={RotateCcw} onClick={() => setRotation((r) => (r + 270) % 360)} className="flex-1">
                Left
              </Button>
              <span className="w-14 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {rotation}°
              </span>
              <Button variant="secondary" icon={RotateCw} onClick={() => setRotation((r) => (r + 90) % 360)} className="flex-1">
                Right
              </Button>
            </div>
          </div>
          <div>
            <p className="label">Flip</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={flipH ? 'soft' : 'secondary'} icon={FlipHorizontal2} onClick={() => setFlipH((f) => !f)} aria-pressed={flipH}>
                Horizontal
              </Button>
              <Button variant={flipV ? 'soft' : 'secondary'} icon={FlipVertical2} onClick={() => setFlipV((f) => !f)} aria-pressed={flipV}>
                Vertical
              </Button>
            </div>
          </div>
        </>
      }
    />
  );
}
