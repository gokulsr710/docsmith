export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const MIME_EXT: Record<ImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MIME_LABEL: Record<ImageMime, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

/** Largest canvas area that is safe on iOS Safari and low-memory Android devices. */
const MAX_CANVAS_AREA = 16_000_000;
const MAX_CANVAS_SIDE = 8192;

export function clampDimensions(w: number, h: number) {
  let scale = 1;
  if (w * h > MAX_CANVAS_AREA) scale = Math.sqrt(MAX_CANVAS_AREA / (w * h));
  if (w * scale > MAX_CANVAS_SIDE) scale = MAX_CANVAS_SIDE / w;
  if (h * scale > MAX_CANVAS_SIDE) scale = Math.min(scale, MAX_CANVAS_SIDE / h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
}

export function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('This image appears to be empty or corrupted.'));
      else resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read. It may be corrupted or in an unsupported format.'));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: ImageMime, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Your browser could not encode this image. Try a smaller image.'));
        // Some browsers silently fall back to PNG when a format (e.g. WEBP on old Safari) is unsupported.
        if (blob.type && blob.type !== type)
          return reject(new Error(`Your browser does not support exporting ${MIME_LABEL[type]} images.`));
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export interface DrawOptions {
  rotation?: number; // degrees, multiple of 90
  flipH?: boolean;
  flipV?: boolean;
  crop?: { x: number; y: number; width: number; height: number }; // in source pixels
  width?: number; // output size (of the cropped region, before rotation)
  height?: number;
  background?: string | null; // fill colour (needed for JPEG)
}

type Drawable = CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number };

/** Draws an image into a new canvas applying crop → scale → flip → rotate. */
export function drawImage(img: Drawable, opts: DrawOptions = {}) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const crop = opts.crop ?? { x: 0, y: 0, width: srcW, height: srcH };
  const target = clampDimensions(opts.width ?? crop.width, opts.height ?? crop.height);
  const rot = (((opts.rotation ?? 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;

  const canvas = document.createElement('canvas');
  canvas.width = swap ? target.height : target.width;
  canvas.height = swap ? target.width : target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(opts.flipH ? -1 : 1, opts.flipV ? -1 : 1);
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, -target.width / 2, -target.height / 2, target.width, target.height);
  return canvas;
}

export function mimeForFile(file: File): ImageMime {
  const t = file.type.toLowerCase();
  if (t === 'image/png' || /\.png$/i.test(file.name)) return 'image/png';
  if (t === 'image/webp' || /\.webp$/i.test(file.name)) return 'image/webp';
  return 'image/jpeg';
}

let webpSupport: boolean | null = null;
export function supportsWebpExport(): boolean {
  if (webpSupport === null) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

/** Reads the EXIF orientation (1–8) from JPEG bytes; returns 1 when absent. */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    offset += 2 + size;
  }
  return 1;
}
