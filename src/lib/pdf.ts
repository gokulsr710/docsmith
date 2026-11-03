import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { clampDimensions } from './image';

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

/** Lazily loads PDF.js (legacy build for wider mobile browser support). */
export function getPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as Promise<PdfJs>,
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])
      .then(([lib, worker]) => {
        lib.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
        return lib;
      })
      .catch((e) => {
        pdfjsPromise = null;
        throw e;
      });
  }
  return pdfjsPromise;
}

export class PdfError extends Error {}

function friendlyPdfError(err: unknown): Error {
  const name = (err as { name?: string })?.name ?? '';
  const message = String((err as Error)?.message ?? '');
  if (name === 'PasswordException' || /encrypt|password/i.test(message))
    return new PdfError('This PDF is password-protected. Please remove the password and try again.');
  if (name === 'InvalidPDFException' || name === 'FormatError' || /invalid|parse|header/i.test(message))
    return new PdfError('This file is not a valid PDF or it is corrupted.');
  return new PdfError(message || 'Could not read this PDF.');
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  try {
    // PDF.js transfers the buffer to its worker, so pass a copy.
    return await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false }).promise;
  } catch (e) {
    throw friendlyPdfError(e);
  }
}

export async function loadPdfLib(data: ArrayBuffer) {
  const { PDFDocument } = await import('pdf-lib');
  try {
    return await PDFDocument.load(data, { updateMetadata: false });
  } catch (e) {
    throw friendlyPdfError(e);
  }
}

export async function renderPage(page: PDFPageProxy, scale: number, background = '#ffffff') {
  let viewport = page.getViewport({ scale });
  const clamped = clampDimensions(viewport.width, viewport.height);
  if (clamped.scale < 1) viewport = page.getViewport({ scale: scale * clamped.scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Renders a small JPEG thumbnail as an object URL. Caller must revoke it. */
export async function renderThumbnail(doc: PDFDocumentProxy, pageNumber: number, width = 200): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const canvas = await renderPage(page, (width * Math.min(2, window.devicePixelRatio || 1)) / base.width);
  page.cleanup();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('Could not render page preview.');
  return URL.createObjectURL(blob);
}

/**
 * Parses "1-3, 5, 8-" into groups of zero-based page indices.
 * Returns an error message string on invalid input.
 */
export function parseRanges(input: string, pageCount: number): number[][] | string {
  const parts = input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return 'Enter at least one page or range, e.g. 1-3, 5';
  const groups: number[][] = [];
  for (const part of parts) {
    const m = part.match(/^(\d*)\s*(?:-|–|to)\s*(\d*)$/i);
    let start: number;
    let end: number;
    if (m && (m[1] || m[2])) {
      start = m[1] ? parseInt(m[1], 10) : 1;
      end = m[2] ? parseInt(m[2], 10) : pageCount;
    } else if (/^\d+$/.test(part)) {
      start = end = parseInt(part, 10);
    } else {
      return `"${part}" is not a valid page or range.`;
    }
    if (start < 1 || end < 1 || start > pageCount || end > pageCount)
      return `"${part}" is outside this document (pages 1–${pageCount}).`;
    if (start > end) return `"${part}" — the start page must come before the end page.`;
    groups.push(Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i));
  }
  return groups;
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: 'application/pdf' });
}
