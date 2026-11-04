import type { PDFPageProxy } from 'pdfjs-dist';

export interface PdfImageObject {
  width: number;
  height: number;
  data?: Uint8ClampedArray;
  kind?: number;
  bitmap?: ImageBitmap;
}

/** Resolves a PDF.js image object by name, giving up after a timeout. */
export function getPdfImageObject(page: PDFPageProxy, name: string): Promise<PdfImageObject | null> {
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
export function pdfImageToCanvas(obj: PdfImageObject): HTMLCanvasElement | null {
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
