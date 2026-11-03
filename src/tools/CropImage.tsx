import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Crop, Maximize } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { useImageItems } from '../components/tool/useImageItems';
import { Button } from '../components/ui/Button';
import { NumberInput, Segmented } from '../components/ui/controls';
import { baseName, formatBytes } from '../lib/files';
import { MIME_EXT, canvasToBlob, drawImage, loadImage, mimeForFile, releaseCanvas } from '../lib/image';
import { getTool } from '../lib/tools';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Handle = 'nw' | 'ne' | 'sw' | 'se';
type Aspect = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16';

const RATIOS: Record<Aspect, number | null> = { free: null, '1:1': 1, '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '9:16': 9 / 16 };
const MIN = 16;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function centered(W: number, H: number, ratio: number | null, fill = 0.8): Rect {
  let w = W * fill;
  let h = H * fill;
  if (ratio) {
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
  }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

function resizeRect(s: Rect, handle: Handle, dx: number, dy: number, ratio: number | null, W: number, H: number): Rect {
  const west = handle.includes('w');
  const north = handle.includes('n');
  const ax = west ? s.x + s.w : s.x; // anchor (opposite corner)
  const ay = north ? s.y + s.h : s.y;
  const cx = clamp((west ? s.x : s.x + s.w) + dx, 0, W);
  const cy = clamp((north ? s.y : s.y + s.h) + dy, 0, H);
  let w = Math.max(MIN, west ? ax - cx : cx - ax);
  let h = Math.max(MIN, north ? ay - cy : cy - ay);
  if (ratio) {
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    const maxW = west ? ax : W - ax;
    const maxH = north ? ay : H - ay;
    if (w > maxW) [w, h] = [maxW, maxW / ratio];
    if (h > maxH) [w, h] = [maxH * ratio, maxH];
  }
  return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
}

export default function CropImage() {
  const tool = getTool('crop-image');
  const images = useImageItems();
  const run = useToolRun(tool.id);
  const item = images.items[0];
  const [aspect, setAspect] = useState<Aspect>('free');
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | Handle; px: number; py: number; start: Rect } | null>(null);

  const W = item?.width ?? 0;
  const H = item?.height ?? 0;

  useEffect(() => {
    if (item) setRect(centered(item.width, item.height, RATIOS[aspect]));
  }, [item, aspect]);

  const scale = () => (frame.current ? W / frame.current.getBoundingClientRect().width : 1);

  const onPointerDown = (mode: 'move' | Handle) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, start: rect };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const k = scale();
    const dx = (e.clientX - d.px) * k;
    const dy = (e.clientY - d.py) * k;
    if (d.mode === 'move') setRect({ ...d.start, x: clamp(d.start.x + dx, 0, W - d.start.w), y: clamp(d.start.y + dy, 0, H - d.start.h) });
    else setRect(resizeRect(d.start, d.mode, dx, dy, RATIOS[aspect], W, H));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = (e.altKey ? 1 : 10) * Math.max(1, Math.round(scale()));
    const k: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = k[e.key];
    if (!v) return;
    e.preventDefault();
    if (e.shiftKey) setRect((r) => resizeRect(r, 'se', v[0], v[1], RATIOS[aspect], W, H));
    else setRect((r) => ({ ...r, x: clamp(r.x + v[0], 0, W - r.w), y: clamp(r.y + v[1], 0, H - r.h) }));
  };

  const setSize = (key: 'w' | 'h', value: number) => {
    const ratio = RATIOS[aspect];
    setRect((r) => {
      let w = key === 'w' ? clamp(value, MIN, W) : r.w;
      let h = key === 'h' ? clamp(value, MIN, H) : r.h;
      if (ratio) {
        if (key === 'w') h = w / ratio;
        else w = h * ratio;
        if (h > H) [h, w] = [H, H * ratio];
        if (w > W) [w, h] = [W, W / ratio];
      }
      return { x: clamp(r.x, 0, W - w), y: clamp(r.y, 0, H - h), w, h };
    });
  };

  const crop = () => {
    if (!item) return;
    run.start(async (report) => {
      report(0.2, 'Cropping…');
      const img = await loadImage(item.file);
      const mime = mimeForFile(item.file);
      const r = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.w), height: Math.round(rect.h) };
      const canvas = drawImage(img, { crop: r, background: mime === 'image/jpeg' ? '#ffffff' : null });
      const blob = await canvasToBlob(canvas, mime, 0.95);
      releaseCanvas(canvas);
      return {
        outputs: [{ name: `${baseName(item.file.name)}-cropped.${MIME_EXT[mime]}`, blob }],
        zipName: 'cropped.zip',
        title: 'Your image is cropped!',
        message: `${r.width}×${r.height} px · ${formatBytes(blob.size)}`,
      };
    });
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const handles: Handle[] = ['nw', 'ne', 'sw', 'se'];
  const handlePos: Record<Handle, string> = {
    nw: '-top-1 -left-1 cursor-nwse-resize',
    ne: '-top-1 -right-1 cursor-nesw-resize',
    sw: '-bottom-1 -left-1 cursor-nesw-resize',
    se: '-bottom-1 -right-1 cursor-nwse-resize',
  };

  return (
    <ToolLayout
      tool={tool}
      accept={['image']}
      multiple={false}
      onFiles={(f) => images.add(f, true)}
      hasFiles={!!item || images.loading}
      run={run}
      onReset={images.clear}
      resetLabel="Crop another image"
      heading={item && <span className="truncate">{item.file.name} <span className="font-normal text-slate-400">· {item.width}×{item.height}</span></span>}
      action={{ label: 'Crop image', icon: Crop, onClick: crop, disabled: !item || rect.w < 1, hint: `${Math.round(rect.w)} × ${Math.round(rect.h)} px` }}
      settings={
        <>
          <Segmented
            label="Aspect ratio"
            value={aspect}
            onChange={setAspect}
            columns={3}
            options={(Object.keys(RATIOS) as Aspect[]).map((a) => ({ value: a, label: a === 'free' ? 'Free' : a }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Width" value={Math.round(rect.w)} onChange={(v) => setSize('w', v)} max={W} suffix="px" />
            <NumberInput label="Height" value={Math.round(rect.h)} onChange={(v) => setSize('h', v)} max={H} suffix="px" />
          </div>
          <Button variant="secondary" icon={Maximize} className="w-full" onClick={() => setRect(centered(W, H, RATIOS[aspect], 1))}>
            Select maximum area
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Drag the box to move it and the corners to resize. With the box focused, use arrow keys to move and Shift + arrows to resize.</p>
        </>
      }
    >
      {item && (
        <div className="card flex items-center justify-center overflow-hidden p-3 sm:p-6">
          <div ref={frame} className="checker relative inline-block overflow-hidden touch-none select-none" onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
            <img src={item.url} alt={item.file.name} draggable={false} className="block max-h-[60vh] w-auto max-w-full" />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Crop area"
              aria-valuetext={`${Math.round(rect.w)} by ${Math.round(rect.h)} pixels at ${Math.round(rect.x)}, ${Math.round(rect.y)}`}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown('move')}
              className="absolute cursor-move outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              style={{ left: pct(rect.x, W), top: pct(rect.y, H), width: pct(rect.w, W), height: pct(rect.h, H), boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.55)' }}
            >
              <div className="pointer-events-none absolute inset-0 border-2 border-white">
                <div className="absolute inset-x-0 top-1/3 border-t border-white/50" />
                <div className="absolute inset-x-0 top-2/3 border-t border-white/50" />
                <div className="absolute inset-y-0 left-1/3 border-l border-white/50" />
                <div className="absolute inset-y-0 left-2/3 border-l border-white/50" />
              </div>
              {handles.map((h) => (
                <span
                  key={h}
                  onPointerDown={onPointerDown(h)}
                  className={`absolute size-5 rounded-full border-2 border-white bg-brand-600 shadow before:absolute before:-inset-3 before:content-[''] ${handlePos[h]}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
