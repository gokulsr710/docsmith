/**
 * PDF → Word conversion, entirely in the browser: PDF.js extracts positioned
 * text runs and images, which are rebuilt into paragraphs with the `docx`
 * library ("editable"), or each page is placed as an image for a pixel-perfect
 * copy ("exact layout"). Word → PDF lives in docxLayout.ts.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { canvasToBlob, releaseCanvas } from './image';
import { getPdfjs, renderPage } from './pdf';
import { getPdfImageObject, pdfImageToCanvas } from './pdfImages';
import { nextFrame } from './files';

/* ------------------------------------------------------------------ */
/* PDF → DOCX                                                          */
/* ------------------------------------------------------------------ */

type Matrix = [number, number, number, number, number, number];

interface Run {
  text: string;
  size: number;
  bold: boolean;
  italic: boolean;
}
interface Line {
  y: number;
  x0: number;
  x1: number;
  size: number;
  runs: Run[];
}
type Block =
  | { kind: 'para'; y: number; lines: Line[] }
  | { kind: 'image'; y: number; data: Uint8Array; width: number; height: number };

interface PageModel {
  width: number;
  height: number;
  blocks: Block[];
  hasText: boolean;
}

const BOLD = /bold|black|heavy|semibold|demi/i;
const ITALIC = /italic|oblique/i;

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

async function readPage(page: PDFPageProxy, withImages: boolean): Promise<PageModel> {
  const pdfjs = await getPdfjs();
  const viewport = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();

  // Font style lookup (fonts are resolved once the operator list has loaded).
  const fontStyle = new Map<string, { bold: boolean; italic: boolean }>();
  const styleOf = (fontName: string) => {
    let s = fontStyle.get(fontName);
    if (!s) {
      let name = '';
      let flags: { bold?: boolean; black?: boolean; italic?: boolean } = {};
      try {
        const f = page.commonObjs.get(fontName) as { name?: string; bold?: boolean; black?: boolean; italic?: boolean };
        name = f?.name ?? '';
        flags = f ?? {};
      } catch {
        /* font not loaded: treat as regular */
      }
      s = { bold: BOLD.test(name) || !!flags.bold || !!flags.black, italic: ITALIC.test(name) || !!flags.italic };
      fontStyle.set(fontName, s);
    }
    return s;
  };

  // 1. Text → lines, in content-stream (reading) order.
  const text = await page.getTextContent();
  const lines: Line[] = [];
  let line: Line | null = null;
  for (const raw of text.items) {
    if (!('str' in raw)) continue;
    const item = raw as unknown as { str: string; transform: Matrix; width: number; fontName: string; hasEOL?: boolean };
    const t = pdfjs.Util.transform(viewport.transform, item.transform) as Matrix;
    const size = Math.max(1, Math.hypot(t[2], t[3]));
    const x = t[4];
    const y = t[5];
    if (item.str.trim() || item.str === ' ') {
      if (!line || Math.abs(y - line.y) > size * 0.5) {
        if (line) lines.push(line);
        line = { y, x0: x, x1: x, size, runs: [] };
      }
      const st = styleOf(item.fontName);
      const prev = line.runs[line.runs.length - 1];
      let str = item.str;
      // Insert a space when there is a visible gap between fragments.
      if (prev && x - line.x1 > size * 0.2 && !prev.text.endsWith(' ') && !str.startsWith(' ')) str = ' ' + str;
      if (prev && prev.bold === st.bold && prev.italic === st.italic && Math.abs(prev.size - size) < 0.5) prev.text += str;
      else line.runs.push({ text: str, size, bold: st.bold, italic: st.italic });
      line.x0 = Math.min(line.x0, x);
      line.x1 = Math.max(line.x1, x + item.width);
      line.size = Math.max(line.size, size);
    }
    if (item.hasEOL && line) {
      lines.push(line);
      line = null;
    }
  }
  if (line) lines.push(line);
  const textLines = lines.filter((l) => l.runs.some((r) => r.text.trim()));

  // 2. Lines → paragraphs.
  const blocks: Block[] = [];
  let para: Extract<Block, { kind: 'para' }> | null = null;
  for (const l of textLines) {
    const last = para?.lines[para.lines.length - 1];
    const gap = last ? l.y - last.y : Infinity;
    const sameStyle = last && Math.abs(last.size - l.size) < 1;
    if (para && last && sameStyle && gap > 0 && gap <= last.size * 1.75) para.lines.push(l);
    else {
      para = { kind: 'para', y: l.y - l.size, lines: [l] };
      blocks.push(para);
    }
  }

  // 3. Images with their position, by replaying the transformation matrix.
  if (withImages) {
    const { OPS } = pdfjs;
    let ctm = viewport.transform as Matrix;
    const stack: Matrix[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix);
      else if (fn === OPS.paintImageXObject && typeof args?.[0] === 'string' && !seen.has(args[0])) {
        const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
        const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        if (width < 24 || height < 24) continue;
        seen.add(args[0]);
        const obj = await getPdfImageObject(page, args[0]);
        const canvas = obj && pdfImageToCanvas(obj);
        if (!canvas) continue;
        const png = await canvasToBlob(canvas, 'image/png');
        releaseCanvas(canvas);
        blocks.push({ kind: 'image', y: Math.min(...ys), data: new Uint8Array(await png.arrayBuffer()), width, height });
      }
    }
    blocks.sort((a, b) => a.y - b.y);
  }

  return { width: viewport.width, height: viewport.height, blocks, hasText: textLines.length > 0 };
}

async function pageImage(page: PDFPageProxy) {
  const canvas = await renderPage(page, 2);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  releaseCanvas(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

export interface PdfToWordResult {
  blob: Blob;
  /** Pages with no extractable text that were inserted as images. */
  imagePages: number;
  totalChars: number;
}

export async function pdfToDocx(
  pdf: PDFDocumentProxy,
  mode: 'editable' | 'layout',
  report: (value: number, label: string) => void,
): Promise<PdfToWordResult> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } = docx;
  const PX = 96 / 72; // points → CSS pixels (docx image sizes are in pixels)
  const TWIP = 20; // points → twentieths of a point (docx page sizes)

  const sections: ConstructorParameters<typeof Document>[0]['sections'][number][] = [];
  let imagePages = 0;
  let totalChars = 0;

  if (mode === 'layout') {
    for (let i = 1; i <= pdf.numPages; i++) {
      report((i - 1) / pdf.numPages, `Rendering page ${i} of ${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const data = await pageImage(page);
      page.cleanup();
      sections.push({
        properties: { page: { size: { width: vp.width * TWIP, height: vp.height * TWIP }, margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 } } },
        children: [new Paragraph({ children: [new ImageRun({ type: 'jpg', data, transformation: { width: vp.width * PX * 0.995, height: vp.height * PX * 0.995 } })] })],
      });
      await nextFrame();
    }
  } else {
    const pages: PageModel[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      report(((i - 1) / pdf.numPages) * 0.85, `Reading page ${i} of ${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const model = await readPage(page, true);
      if (!model.hasText) {
        // Scanned page: keep it visible as an image.
        model.blocks = [{ kind: 'image', y: 0, data: await pageImage(page), width: model.width, height: model.height }];
        imagePages++;
      }
      page.cleanup();
      pages.push(model);
    }

    // Body text size = the size used by the most characters; larger text becomes headings.
    const sizeChars = new Map<number, number>();
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.kind !== 'para') return;
        b.lines.forEach((l) => l.runs.forEach((r) => {
          const k = Math.round(r.size);
          sizeChars.set(k, (sizeChars.get(k) ?? 0) + r.text.length);
          totalChars += r.text.trim().length;
        }));
      }),
    );
    const body = [...sizeChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;

    report(0.9, 'Building Word document…');
    for (const p of pages) {
      const margin = 54; // 0.75in
      const maxW = (p.width - 2 * margin) * PX;
      const children = p.blocks.map((b) => {
        if (b.kind === 'image') {
          const scale = Math.min(1, maxW / (b.width * PX), ((p.height - 2 * margin) * PX) / (b.height * PX));
          const fullPage = !p.hasText;
          const w = fullPage ? maxW : b.width * PX * scale;
          const h = fullPage ? (b.height / b.width) * maxW : b.height * PX * scale;
          return new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: fullPage ? 'jpg' : 'png', data: b.data, transformation: { width: w, height: h } })] });
        }
        const first = b.lines[0];
        const size = Math.max(...b.lines.map((l) => l.size));
        const width = Math.max(...b.lines.map((l) => l.x1)) - Math.min(...b.lines.map((l) => l.x0));
        const centered = Math.abs((first.x0 + first.x1) / 2 - p.width / 2) < p.width * 0.05 && width < p.width * 0.6;
        const ratio = size / body;
        const heading = ratio >= 1.6 ? HeadingLevel.HEADING_1 : ratio >= 1.3 ? HeadingLevel.HEADING_2 : ratio >= 1.12 ? HeadingLevel.HEADING_3 : undefined;

        // Re-flow lines into one paragraph, joining hyphenated words.
        const runs: Run[] = [];
        b.lines.forEach((l, li) => {
          l.runs.forEach((r, ri) => {
            let t = r.text;
            if (li > 0 && ri === 0) {
              const prev = runs[runs.length - 1];
              if (prev && /[a-z]-$/i.test(prev.text) && /^[a-z]/.test(t)) prev.text = prev.text.slice(0, -1);
              else if (prev && !prev.text.endsWith(' ') && !t.startsWith(' ')) t = ' ' + t;
            }
            runs.push({ ...r, text: t });
          });
        });
        return new Paragraph({
          heading,
          alignment: centered ? AlignmentType.CENTER : undefined,
          spacing: { after: Math.round(size * 0.6 * TWIP) },
          children: runs.map((r) => new TextRun({ text: r.text, size: Math.round(r.size * 2), bold: r.bold || undefined, italics: r.italic || undefined, color: '000000', font: 'Calibri' })),
        });
      });
      sections.push({
        properties: { page: { size: { width: Math.round(p.width * TWIP), height: Math.round(p.height * TWIP) }, margin: { top: margin * TWIP, right: margin * TWIP, bottom: margin * TWIP, left: margin * TWIP } } },
        children: children.length ? children : [new Paragraph({})],
      });
    }
  }

  report(0.96, 'Saving .docx…');
  const document = new Document({ creator: 'Docsmith', title: 'Converted document', sections });
  const blob = await Packer.toBlob(document);
  return { blob, imagePages, totalChars };
}
