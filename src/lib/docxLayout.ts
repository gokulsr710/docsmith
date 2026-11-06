/**
 * Word → PDF with the original layout, entirely in the browser.
 *
 * 1. docx-preview turns the .docx into styled HTML: fonts, sizes, spacing,
 *    indents, tables, images, lists, headers and footers, one block per
 *    paragraph or table, grouped by Word section (page size, margins, columns).
 * 2. Word fonts are swapped for bundled, metric-compatible open fonts
 *    (Times New Roman → Liberation Serif, Calibri → Carlito…) so lines wrap
 *    where Word wraps them, and the same font files can be embedded in the PDF.
 * 3. Our own paginator measures every block and flows it onto real pages:
 *    multi-column sections, continuous section breaks with balanced columns,
 *    paragraphs split between lines (widow/orphan control), tables split
 *    between rows, "keep with next", and page/column breaks.
 * 4. The laid-out pages are drawn into a PDF with pdf-lib: every word at its
 *    exact position in the embedded font (selectable, searchable text),
 *    images, table borders, shading, underlines and links.
 */
import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib';

const PT = 0.75; // CSS px → PDF points
const EPS = 0.5;

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

type Face = 'serif' | 'sans' | 'mono' | 'carlito' | 'caladea' | 'fallback';
const FACE_FILES: Record<Face, [string, string, string, string]> = {
  serif: ['LiberationSerif-Regular', 'LiberationSerif-Bold', 'LiberationSerif-Italic', 'LiberationSerif-BoldItalic'],
  sans: ['LiberationSans-Regular', 'LiberationSans-Bold', 'LiberationSans-Italic', 'LiberationSans-BoldItalic'],
  mono: ['LiberationMono-Regular', 'LiberationMono-Bold', 'LiberationMono-Italic', 'LiberationMono-BoldItalic'],
  carlito: ['DocsmithCal-Regular', 'DocsmithCal-Bold', 'DocsmithCal-Italic', 'DocsmithCal-BoldItalic'],
  caladea: ['Caladea-Regular', 'Caladea-Bold', 'Caladea-Italic', 'Caladea-BoldItalic'],
  fallback: ['DejaVuSans', 'DejaVuSans-Bold', 'DejaVuSans', 'DejaVuSans-Bold'],
};
const FACES = Object.keys(FACE_FILES) as Face[];

/**
 * Word's "single" line spacing is the font's natural line height (Times New
 * Roman 1.15, Calibri 1.22, Cambria 1.17 × the font size); multiples scale it.
 */
const LINE_RATIO: Record<Face, number> = { serif: 1.15, sans: 1.15, mono: 1.133, carlito: 1.2207, caladea: 1.172, fallback: 1.164 };

const FAMILY_MAP: Record<string, Face> = {};
const alias = (face: Face, names: string) => names.split('|').forEach((n) => (FAMILY_MAP[n] = face));
alias('serif', 'times new roman|times|liberation serif|tinos|georgia|garamond|book antiqua|palatino linotype|palatino|century schoolbook|bookman old style|constantia|baskerville old face|serif');
alias('caladea', 'cambria|caladea');
alias('carlito', 'calibri|calibri light|carlito|aptos|aptos display|aptos narrow');
alias('sans', 'arial|helvetica|liberation sans|arimo|verdana|tahoma|segoe ui|trebuchet ms|century gothic|arial narrow|franklin gothic book|gill sans mt|lucida sans|roboto|open sans|lato|noto sans|sans-serif');
alias('mono', 'courier new|courier|consolas|lucida console|liberation mono|cousine|menlo|monaco|monospace');

function faceForFamily(family: string): Face {
  for (const raw of family.split(',')) {
    const name = raw.trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (name.startsWith('ds-')) return name.slice(3) as Face;
    if (FAMILY_MAP[name]) return FAMILY_MAP[name];
    if (/mono|code|console/.test(name)) return 'mono';
    if (/serif|roman|book|garamond|times/.test(name) && !/sans/.test(name)) return 'serif';
  }
  return 'sans';
}

const fontUrl = (file: string) => `${import.meta.env.BASE_URL}fonts/${file}.ttf`;

/** @font-face rules for the bundled fonts (also copied into the print frame). */
function fontFaceCss() {
  return FACES.flatMap((face) =>
    FACE_FILES[face].map((file, i) => {
      const weight = i % 2 ? 700 : 400;
      const style = i >= 2 && face !== 'fallback' ? 'italic' : 'normal';
      return `@font-face{font-family:'ds-${face}';src:url('${fontUrl(file)}') format('truetype');font-weight:${weight};font-style:${style};font-display:block}`;
    }),
  ).join('\n');
}

const LAYOUT_CSS = `
.ds-host{position:fixed;left:-100000px;top:0;pointer-events:none;contain:layout style;line-height:normal;font-size:16px;color:#000;letter-spacing:normal;word-spacing:normal;text-align:left;text-transform:none;white-space:normal}
.docx.ds-page,.docx.ds-measure{hyphens:manual;-webkit-hyphens:manual;font-kerning:none;font-variant-ligatures:none;font-feature-settings:"kern" 0,"liga" 0;text-rendering:geometricPrecision;color:#000;background:#fff;line-height:normal}
.docx.ds-page{position:relative;overflow:hidden;box-sizing:border-box;margin:0;padding:0;display:block;min-height:0}
.docx.ds-measure{display:block;padding:0;margin:0;min-height:0;box-sizing:border-box}
.ds-blk{display:flow-root}
.ds-col{position:absolute}
.ds-frag{overflow:hidden;position:relative}
.ds-hf{position:absolute}
`;

function ensureGlobalStyles() {
  if (document.getElementById('ds-layout-styles')) return;
  const style = document.createElement('style');
  style.id = 'ds-layout-styles';
  style.textContent = fontFaceCss() + LAYOUT_CSS;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/* Word XML: section starts, keep-with-next, page breaks               */
/* ------------------------------------------------------------------ */

type SectionStart = 'nextPage' | 'continuous' | 'nextColumn';
interface SectionXml {
  start: SectionStart;
  headerDist: number; // px
  footerDist: number; // px
}
interface ParaXml {
  keepNext: boolean;
  keepLines: boolean;
  widowControl: boolean;
  breakBefore: boolean;
  breakAfter: boolean;
  colBreakAfter: boolean;
}
interface DocXml {
  sections: SectionXml[];
  /** Header/footer paragraphs with page-number fields. */
  fields: FieldPara[];
  /** One entry per top-level paragraph (P) or table (null), in document order. */
  blocks: (ParaXml | null)[];
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const kids = (el: Element | null | undefined, name?: string) => (el ? [...el.children].filter((c) => !name || c.localName === name) : []);
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0];
const wAttr = (el: Element | undefined, name: string) => el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null;
/** Value of an on/off property: present without w:val means on. */
function onOff(el: Element | undefined): boolean | undefined {
  if (!el) return undefined;
  const v = wAttr(el, 'val');
  return v === null || !['0', 'false', 'off'].includes(v);
}

async function readDocXml(buf: ArrayBuffer): Promise<DocXml | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buf);
    const docText = await zip.file('word/document.xml')?.async('string');
    if (!docText) return null;
    const stylesText = (await zip.file('word/styles.xml')?.async('string')) ?? '';
    const parse = (t: string) => new DOMParser().parseFromString(t, 'application/xml');
    const doc = parse(docText);
    const styles = stylesText ? parse(stylesText) : null;

    // Paragraph style chain → keep/widow properties.
    type Props = Partial<Pick<ParaXml, 'keepNext' | 'keepLines' | 'widowControl'>> & { pageBreakBefore?: boolean };
    const readProps = (pPr: Element | undefined): Props => ({
      keepNext: onOff(kid(pPr, 'keepNext')),
      keepLines: onOff(kid(pPr, 'keepLines')),
      widowControl: onOff(kid(pPr, 'widowControl')),
      pageBreakBefore: onOff(kid(pPr, 'pageBreakBefore')),
    });
    const styleEls = new Map<string, Element>();
    let defaultStyle: string | null = null;
    for (const s of styles ? [...styles.getElementsByTagNameNS(W, 'style')] : []) {
      if (wAttr(s, 'type') !== 'paragraph') continue;
      const id = wAttr(s, 'styleId');
      if (!id) continue;
      styleEls.set(id, s);
      if (['1', 'true', 'on'].includes(wAttr(s, 'default') ?? '')) defaultStyle = id;
    }
    const docDefaults = readProps(kid(styles?.getElementsByTagNameNS(W, 'pPrDefault')[0], 'pPr'));
    const styleCache = new Map<string, Props>();
    const styleProps = (id: string | null, depth = 0): Props => {
      if (!id || depth > 20) return docDefaults;
      const hit = styleCache.get(id);
      if (hit) return hit;
      const s = styleEls.get(id);
      if (!s) return docDefaults;
      const base = styleProps(wAttr(kid(s, 'basedOn'), 'val'), depth + 1);
      const own = readProps(kid(s, 'pPr'));
      const merged: Props = { ...base };
      (Object.keys(own) as (keyof Props)[]).forEach((k) => own[k] !== undefined && (merged[k] = own[k]));
      styleCache.set(id, merged);
      return merged;
    };

    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    const flat: Element[] = [];
    const walk = (parent: Element) => {
      for (const c of kids(parent)) {
        if (c.localName === 'p' || c.localName === 'tbl') flat.push(c);
        else if (c.localName === 'sdt') walk(kid(c, 'sdtContent') ?? c);
        else if (c.localName === 'customXml') walk(c);
      }
    };
    walk(body);

    const sections: SectionXml[] = [];
    const readSect = (sectPr: Element) => {
      const type = wAttr(kid(sectPr, 'type'), 'val');
      const pgMar = kid(sectPr, 'pgMar');
      const twip = (v: string | null, d: number) => ((v ? Number(v) : d) / 20) * (96 / 72);
      sections.push({
        start: type === 'continuous' ? 'continuous' : type === 'nextColumn' ? 'nextColumn' : 'nextPage',
        headerDist: twip(wAttr(pgMar, 'header'), 720),
        footerDist: twip(wAttr(pgMar, 'footer'), 720),
      });
    };

    const blocks: (ParaXml | null)[] = flat.map((el) => {
      if (el.localName === 'tbl') return null;
      const pPr = kid(el, 'pPr');
      const sect = kid(pPr, 'sectPr');
      if (sect) readSect(sect);
      const own = readProps(pPr);
      const st = styleProps(wAttr(kid(pPr, 'pStyle'), 'val') ?? defaultStyle);
      const pick = <K extends keyof Props>(k: K) => (own[k] !== undefined ? own[k] : st[k]);
      // Page / column breaks inside the paragraph: before any text → break before, otherwise after.
      let breakBefore = !!pick('pageBreakBefore');
      let breakAfter = false;
      let colBreakAfter = false;
      let seenText = false;
      for (const node of el.getElementsByTagNameNS(W, '*')) {
        if (node.localName === 't' && node.textContent) seenText = true;
        else if (node.localName === 'drawing' || node.localName === 'pict') seenText = true;
        else if (node.localName === 'br') {
          const t = wAttr(node, 'type');
          if (t === 'page') {
            if (seenText) breakAfter = true;
            else breakBefore = true;
          } else if (t === 'column') colBreakAfter = true;
        }
      }
      return {
        keepNext: !!pick('keepNext'),
        keepLines: !!pick('keepLines'),
        widowControl: pick('widowControl') ?? true,
        breakBefore,
        breakAfter,
        colBreakAfter,
      };
    });
    const finalSect = kid(body, 'sectPr');
    if (finalSect) readSect(finalSect);

    const fields: FieldPara[] = [];
    for (const name of Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))) {
      const t = await zip.file(name)?.async('string');
      if (t) fields.push(...readFields(parse(t)));
    }
    return { sections, blocks, fields };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* List markers and page-number fields                                 */
/* ------------------------------------------------------------------ */

function cssUnescape(s: string) {
  return s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_m, hex: string | undefined, ch: string | undefined) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : (ch ?? '')));
}

function parseCounters(v: string, dflt: number): [string, number][] {
  if (!v || v === 'none') return [];
  const out: [string, number][] = [];
  const parts = v.trim().split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const n = Number(parts[i + 1]);
    if (i + 1 < parts.length && Number.isFinite(n) && /^-?\d+$/.test(parts[i + 1])) {
      out.push([parts[i], n]);
      i++;
    } else out.push([parts[i], dflt]);
  }
  return out;
}

function roman(n: number) {
  if (n <= 0 || n >= 4000) return String(n);
  const t: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  for (const [v, r] of t) while (n >= v) (s += r), (n -= v);
  return s;
}
function alpha(n: number) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s || '0';
}
function formatCounter(n: number, style: string) {
  switch (style) {
    case 'lower-alpha':
    case 'lower-latin':
      return alpha(n);
    case 'upper-alpha':
    case 'upper-latin':
      return alpha(n).toUpperCase();
    case 'lower-roman':
      return roman(n);
    case 'upper-roman':
      return roman(n).toUpperCase();
    case 'decimal-leading-zero':
      return n < 10 && n >= 0 ? `0${n}` : String(n);
    case 'disc':
      return '•';
    case 'circle':
      return '◦';
    case 'square':
      return '▪';
    case 'none':
      return '';
    default:
      return String(n);
  }
}

/** Word's Symbol / Wingdings bullets live in the private-use area: map them to Unicode. */
const PUA_BULLETS: Record<number, string> = {
  0xf0b7: '•', 0xf0a7: '▪', 0xf0a8: '□', 0xf06e: '■', 0xf071: '❑', 0xf076: '❖', 0xf0d8: '➢', 0xf0fc: '✓', 0xf0e0: '➔', 0xf0de: '➔', 0xf0f0: '⇨', 0xf06c: '●', 0xf0a1: '○', 0xf09f: '•', 0xf02d: '–', 0xf0be: '—',
};

/**
 * docx-preview draws list numbers and bullets with CSS ::before and counters,
 * which can't be read back as text. Work the counters out in document order and
 * put each marker into the paragraph as a real element.
 */
function materializeListMarkers(src: HTMLElement) {
  const counters = new Map<string, number>();
  const all = [...src.querySelectorAll<HTMLElement>('section.docx, section.docx *')].filter((el) => /^(SECTION|ARTICLE|DIV|P|TABLE|TBODY|TR|TD|TH|HEADER|FOOTER|OL|UL|LI)$/.test(el.tagName));
  const style = document.createElement('style');
  style.textContent = '.ds-nomarker::before{content:none !important;display:none !important}';
  src.appendChild(style);
  for (const el of all) {
    const cs = getComputedStyle(el);
    const bs = getComputedStyle(el, '::before');
    const content = bs.content;
    const hasMarker = el.tagName === 'P' && content && content !== 'none' && content !== 'normal';
    for (const decl of [cs, ...(hasMarker ? [bs] : [])]) {
      parseCounters(decl.counterReset, 0).forEach(([n, v]) => counters.set(n, v));
      parseCounters(decl.counterSet, 0).forEach(([n, v]) => counters.set(n, v));
      parseCounters(decl.counterIncrement, 1).forEach(([n, v]) => counters.set(n, (counters.get(n) ?? 0) + v));
    }
    if (!hasMarker) continue;

    let marker = '';
    const re = /"((?:[^"\\]|\\.)*)"|counters?\(\s*([\w-]+)\s*(?:,\s*("(?:[^"\\]|\\.)*")\s*)?(?:,\s*([\w-]+)\s*)?\)/g;
    for (let m = re.exec(content); m; m = re.exec(content)) {
      if (m[1] !== undefined) marker += cssUnescape(m[1]);
      else marker += formatCounter(counters.get(m[2]) ?? 0, m[4] ?? (m[3] && !m[3].startsWith('"') ? m[3] : 'decimal'));
    }
    marker = [...marker].map((ch) => PUA_BULLETS[ch.codePointAt(0)!] ?? (ch.codePointAt(0)! >= 0xe000 && ch.codePointAt(0)! <= 0xf8ff ? '•' : ch)).join('');
    const hasTab = /\t/.test(marker);
    marker = marker.replace(/\t+$/, '').replace(/\t/g, ' ');

    const span = document.createElement('span');
    span.className = 'ds-marker';
    const symbolic = /symbol|wingdings|webdings/i.test(bs.fontFamily);
    span.style.cssText = `display:inline-block;text-indent:0;white-space:pre;font-family:${symbolic ? "'ds-fallback'" : `'ds-${faceForFamily(bs.fontFamily)}', 'ds-fallback'`};font-size:${bs.fontSize};font-weight:${bs.fontWeight};font-style:${bs.fontStyle};color:${bs.color};text-decoration:none;vertical-align:baseline`;
    span.textContent = marker;
    const indent = px(cs.textIndent);
    el.insertBefore(span, el.firstChild);
    el.classList.add('ds-nomarker');
    // The tab after the number goes to the hanging indent (or the next 0.5in stop).
    const natural = span.getBoundingClientRect().width;
    const stop = 48;
    const target = indent < 0 && natural < -indent - 1 ? -indent : hasTab ? Math.ceil((natural + 1) / stop) * stop : natural + px(bs.fontSize) * 0.3;
    span.style.width = `${target}px`;
  }
}

type FieldKind = 'PAGE' | 'NUMPAGES';
export interface FieldPara {
  /** Paragraph text without whitespace (field results included). */
  text: string;
  ranges: { start: number; len: number; field: FieldKind }[];
}

/** Finds PAGE / NUMPAGES fields in header and footer paragraphs. */
function readFields(xml: Document): FieldPara[] {
  const kindOf = (instr: string): FieldKind | null => (/^\s*PAGE\b/i.test(instr) ? 'PAGE' : /^\s*(NUMPAGES|SECTIONPAGES)\b/i.test(instr) ? 'NUMPAGES' : null);
  const nonWs = (s: string | null) => (s ?? '').replace(/\s+/g, '');
  const out: FieldPara[] = [];
  for (const p of xml.getElementsByTagNameNS(W, 'p')) {
    let text = '';
    const ranges: FieldPara['ranges'] = [];
    const stack: { instr: string; phase: 'code' | 'result'; start: number }[] = [];
    for (const node of p.getElementsByTagNameNS(W, '*')) {
      const top = stack[stack.length - 1];
      if (node.localName === 'fldChar') {
        const t = wAttr(node, 'fldCharType');
        if (t === 'begin') stack.push({ instr: '', phase: 'code', start: text.length });
        else if (t === 'separate' && top) {
          top.phase = 'result';
          top.start = text.length;
        } else if (t === 'end' && top) {
          stack.pop();
          const kind = kindOf(top.instr);
          if (kind) ranges.push({ start: top.phase === 'result' ? top.start : text.length, len: top.phase === 'result' ? text.length - top.start : 0, field: kind });
        }
      } else if (node.localName === 'instrText') {
        if (top) top.instr += node.textContent ?? '';
      } else if (node.localName === 'fldSimple') {
        const kind = kindOf(wAttr(node, 'instr') ?? '');
        const len = [...node.getElementsByTagNameNS(W, 't')].reduce((n, t) => n + nonWs(t.textContent).length, 0);
        if (kind) ranges.push({ start: text.length, len, field: kind });
      } else if (node.localName === 't' && !(top && top.phase === 'code')) text += nonWs(node.textContent);
    }
    if (ranges.length) out.push({ text, ranges });
  }
  return out;
}

/** Replaces page-number field results in headers/footers with placeholders filled per page. */
function markPageFields(src: HTMLElement, fields: FieldPara[]) {
  if (!fields.length) return;
  for (const p of src.querySelectorAll<HTMLElement>('header p, footer p')) {
    const norm = (p.textContent ?? '').replace(/\s+/g, '');
    const f = fields.find((x) => x.text === norm);
    if (!f) continue;
    // Map non-whitespace character indices to text positions.
    const pos: { node: Text; offset: number }[] = [];
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let lastText: Text | null = null;
    for (let n = tw.nextNode() as Text | null; n; n = tw.nextNode() as Text | null) {
      lastText = n;
      for (let i = 0; i < n.data.length; i++) if (n.data[i].trim()) pos.push({ node: n, offset: i });
    }
    // Work from the end so earlier positions stay valid.
    for (const r of [...f.ranges].sort((a, b) => b.start - a.start)) {
      const span = document.createElement('span');
      span.dataset.dsField = r.field;
      span.textContent = '1';
      const range = document.createRange();
      if (r.start < pos.length) range.setStart(pos[r.start].node, pos[r.start].offset);
      else if (lastText) range.setStart(lastText, lastText.data.length);
      else continue;
      if (r.len > 0 && r.start + r.len - 1 < pos.length) {
        const end = pos[r.start + r.len - 1];
        range.setEnd(end.node, end.offset + 1);
        range.deleteContents();
      } else range.collapse(true);
      range.insertNode(span);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rendering the document (once per file)                              */
/* ------------------------------------------------------------------ */

interface SourceSection {
  /** Page geometry in CSS px as Word defines it. */
  pageW: number;
  pageH: number;
  pad: [number, number, number, number]; // top right bottom left
  cols: number;
  gap: number;
  start: SectionStart;
  headerDist: number;
  footerDist: number;
  header: HTMLElement | null;
  footer: HTMLElement | null;
  blocks: { el: HTMLElement; props: ParaXml | null }[];
}

export interface RenderedDocx {
  host: HTMLElement;
  sections: SourceSection[];
  /** Images the browser can't draw (EMF/WMF and similar). */
  droppedImages: number;
  /** Text in scripts the bundled fonts don't cover (Indic, CJK, Arabic…). */
  complexScript: boolean;
  dispose(): void;
}

/** A regex character class from code point ranges. */
function charClass(ranges: [number, number][]) {
  return ranges.map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join('');
}
const COMPLEX_SCRIPT = new RegExp(
  `[${charClass([[0x0590, 0x08ff], [0x0900, 0x0dff], [0x0e00, 0x0fff], [0x1000, 0x109f], [0x1100, 0x11ff], [0x3040, 0x30ff], [0x3400, 0x9fff], [0xac00, 0xd7af], [0xf900, 0xfaff]])}]`,
);

const px = (v: string) => parseFloat(v) || 0;

function imageBroken(img: HTMLImageElement) {
  return img.complete && img.naturalWidth === 0;
}

export async function renderDocx(file: File): Promise<RenderedDocx> {
  ensureGlobalStyles();
  const buf = await file.arrayBuffer();
  const [{ renderAsync }, xml] = await Promise.all([import('docx-preview'), readDocXml(buf)]);

  const host = document.createElement('div');
  host.className = 'ds-host';
  host.setAttribute('aria-hidden', 'true');
  const src = document.createElement('div');
  host.appendChild(src);
  document.body.appendChild(host);
  const dispose = () => host.remove();

  try {
    await renderAsync(buf, src, src, {
      inWrapper: false,
      breakPages: false,
      ignoreLastRenderedPageBreak: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: true,
      experimental: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: false,
      renderChanges: false,
      renderAltChunks: false,
      debug: false,
    } as Parameters<typeof renderAsync>[3]);
  } catch {
    dispose();
    throw new Error('This file could not be read as a Word document. Make sure it is a .docx file (older .doc files must be re-saved as .docx).');
  }

  // Never run anything from the document.
  src.querySelectorAll('script,iframe,object,embed,link,meta,base,form').forEach((el) => el.remove());
  src.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      if (a.name.startsWith('on')) el.removeAttribute(a.name);
      if (a.name === 'href' && !/^(https?:|mailto:|#)/i.test(a.value)) el.removeAttribute('href');
    });
  });

  // Swap every font for a bundled one, decided from the font Word asked for.
  const els = [...src.querySelectorAll<HTMLElement>('section.docx, section.docx *')].filter((el) => !(el instanceof SVGElement));
  const families = els.map((el) => getComputedStyle(el).fontFamily);
  els.forEach((el, i) => (el.style.fontFamily = `'ds-${faceForFamily(families[i])}', 'ds-fallback'`));

  // Load every bundled font the document uses before anything is measured.
  const wanted = new Set<string>(["400 normal 'ds-fallback'", "700 normal 'ds-fallback'"]);
  for (const el of src.querySelectorAll<HTMLElement>('section.docx *')) {
    if (el instanceof SVGElement || !el.firstChild) continue;
    const cs = getComputedStyle(el);
    const bold = (parseInt(cs.fontWeight) || 400) >= 600 ? 700 : 400;
    wanted.add(`${bold} ${cs.fontStyle === 'normal' ? 'normal' : 'italic'} 'ds-${faceForFamily(cs.fontFamily)}'`);
  }
  await Promise.all([...wanted].map((spec) => {
    const [weight, style, family] = spec.split(' ');
    return document.fonts.load(`${style} ${weight} 16px ${family}`).catch(() => []);
  }));
  const text = src.textContent ?? '';

  // Paragraphs take the font of their text (docx-preview only styles the runs),
  // so list numbers and empty lines use the right font.
  const defaultFace = (() => {
    const sec = src.querySelector('section.docx');
    if (!sec) return 'serif' as Face;
    const probe = document.createElement('span');
    sec.appendChild(probe);
    const face = faceForFamily(getComputedStyle(probe).fontFamily);
    probe.remove();
    return face;
  })();
  const faceOfPara = new Map<HTMLElement, Face>();
  for (const p of src.querySelectorAll<HTMLElement>('section.docx p')) {
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let face = defaultFace;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.textContent?.trim() && n.parentElement) {
        face = faceForFamily(n.parentElement.style.fontFamily || getComputedStyle(n.parentElement).fontFamily);
        break;
      }
    }
    faceOfPara.set(p, face);
    p.style.fontFamily = `'ds-${face}', 'ds-fallback'`;
  }

  materializeListMarkers(src);
  if (xml) markPageFields(src, xml.fields);

  // Word sizes each line by the text on it; CSS also adds a "strut" in the
  // paragraph's own font size (the page's 16px), which would loosen small text.
  // Give every paragraph the size of its smallest text, and empty paragraphs
  // the document's default size and one line of height.
  const defaultSize = (() => {
    const sec = src.querySelector('section.docx');
    if (!sec) return 13.333;
    const probe = document.createElement('span');
    sec.appendChild(probe);
    const size = px(getComputedStyle(probe).fontSize) || 13.333;
    probe.remove();
    return size;
  })();
  const paras = [...src.querySelectorAll<HTMLElement>('section.docx p')];
  const sizes = paras.map((p) => {
    let min = Infinity;
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.textContent && n.parentElement) min = Math.min(min, px(getComputedStyle(n.parentElement).fontSize));
    }
    const hasMedia = !!p.querySelector('img,svg');
    return { size: Number.isFinite(min) ? min : defaultSize, empty: !Number.isFinite(min) && !hasMedia };
  });
  paras.forEach((p, i) => (p.style.fontSize = `${sizes[i].size}px`));
  // Relative line spacing (single, 1.5, double…) becomes a multiple of the
  // font's natural line height. Exact spacing in points is left as it is.
  const lineInfo = paras.map((p, i) => {
    const lh = getComputedStyle(p).lineHeight;
    if (lh === 'normal') return { m: 1 };
    p.style.fontSize = `${sizes[i].size * 2}px`;
    const doubled = getComputedStyle(p).lineHeight;
    p.style.fontSize = `${sizes[i].size}px`;
    const a = px(lh);
    return Math.abs(px(doubled) - 2 * a) < 0.05 ? { m: a / sizes[i].size } : null;
  });
  paras.forEach((p, i) => {
    const info = lineInfo[i];
    if (info) p.style.lineHeight = String(+(info.m * LINE_RATIO[faceOfPara.get(p) ?? defaultFace]).toFixed(4));
  });
  paras.forEach((p, i) => {
    if (!sizes[i].empty) {
      p.style.minHeight = '0';
      return;
    }
    const lh = getComputedStyle(p).lineHeight;
    p.style.minHeight = `${lh === 'normal' ? sizes[i].size * LINE_RATIO[faceOfPara.get(p) ?? defaultFace] : px(lh)}px`;
  });

  // Remove broken images (EMF/WMF previews the browser can't decode).
  const imgs = [...src.querySelectorAll('img')];
  await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
  let droppedImages = 0;
  imgs.forEach((img) => {
    if (imageBroken(img)) {
      img.style.visibility = 'hidden';
      droppedImages++;
    }
  });

  const secEls = [...src.querySelectorAll<HTMLElement>(':scope > section.docx')];
  const allBlocks = secEls.flatMap((s) => [...(s.querySelector(':scope > article')?.children ?? [])] as HTMLElement[]);
  const mappable = allBlocks.filter((b) => b.tagName === 'P' || b.tagName === 'TABLE');
  const useXml = !!xml && xml.blocks.length === mappable.length;
  const propsOf = new Map<HTMLElement, ParaXml | null>();
  if (useXml) mappable.forEach((b, i) => propsOf.set(b, xml!.blocks[i]));

  const sections: SourceSection[] = secEls.map((s, i) => {
    const cs = getComputedStyle(s);
    const article = s.querySelector<HTMLElement>(':scope > article');
    const acs = article ? getComputedStyle(article) : null;
    const cols = acs ? Math.max(1, parseInt(acs.columnCount) || 1) : 1;
    const sx = xml && xml.sections.length === secEls.length ? xml.sections[i] : undefined;
    return {
      pageW: px(cs.width) || 816,
      pageH: px(cs.minHeight) || 1056,
      pad: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
      cols,
      gap: cols > 1 ? px(acs!.columnGap) || 48 : 0,
      start: i === 0 ? 'nextPage' : (sx?.start ?? 'nextPage'),
      headerDist: sx?.headerDist ?? 48,
      footerDist: sx?.footerDist ?? 48,
      header: s.querySelector<HTMLElement>(':scope > header'),
      footer: s.querySelector<HTMLElement>(':scope > footer'),
      blocks: ([...(article?.children ?? [])] as HTMLElement[]).filter((b) => b.tagName !== 'STYLE').map((el) => ({ el, props: propsOf.get(el) ?? null })),
    };
  });

  void host.offsetHeight;
  await document.fonts.ready;
  return { host, sections, droppedImages, complexScript: COMPLEX_SCRIPT.test(text), dispose };
}

/* ------------------------------------------------------------------ */
/* Measuring and paginating                                            */
/* ------------------------------------------------------------------ */

export interface PageOverride {
  /** Page size in px, or null for the document's own. */
  size: { w: number; h: number } | null;
  /** Uniform margin in px, or null for the document's own. */
  margin: number | null;
}

interface Blk {
  tpl: HTMLElement; // .ds-blk wrapper, laid out at the column width
  h: number;
  cuts: number[]; // allowed split positions (px from the top of the block)
  /** Space before the paragraph (dropped at the top of a page or column, like Word). */
  mt: number;
  keepNext: boolean;
  breakBefore: boolean;
  breakAfter: boolean;
  colBreakAfter: boolean;
}

interface Sec {
  pageW: number;
  pageH: number;
  pad: [number, number, number, number];
  cols: number;
  gap: number;
  colW: number;
  contentH: number;
  start: SectionStart;
  src: SourceSection;
  blks: Blk[];
}

interface Frag {
  blk: number;
  from: number;
  to: number;
}
interface Region {
  sec: number;
  top: number;
  cols: Frag[][];
}
interface PagePlan {
  sec: number;
  regions: Region[];
}

/** Line boxes of a paragraph, relative to `origin`. */
function lineBoxes(p: HTMLElement, originTop: number): [number, number][] {
  const range = document.createRange();
  range.selectNodeContents(p);
  const rects = [...range.getClientRects()].filter((r) => r.height > 0.5).sort((a, b) => a.top - b.top);
  const lines: [number, number][] = [];
  for (const r of rects) {
    const top = r.top - originTop;
    const bottom = r.bottom - originTop;
    const last = lines[lines.length - 1];
    if (last && top < last[1] - Math.min(r.height, last[1] - last[0]) * 0.5) {
      last[0] = Math.min(last[0], top);
      last[1] = Math.max(last[1], bottom);
    } else lines.push([top, bottom]);
  }
  return lines;
}

function measureSection(src: SourceSection, override: PageOverride, root: HTMLElement): Sec {
  let pageW = src.pageW;
  let pageH = src.pageH;
  if (override.size) {
    pageW = override.size.w;
    pageH = override.size.h;
  }
  const pad: [number, number, number, number] = override.margin !== null ? [override.margin, override.margin, override.margin, override.margin] : [...src.pad];
  const contentW = Math.max(100, pageW - pad[1] - pad[3]);
  const cols = src.cols;
  const gap = src.gap;
  const colW = (contentW - gap * (cols - 1)) / cols;
  const contentH = Math.max(100, pageH - pad[0] - pad[2]);

  const meas = document.createElement('div');
  meas.className = 'docx ds-measure';
  meas.style.width = `${colW}px`;
  root.appendChild(meas);
  const tpls = src.blocks.map(({ el }) => {
    const w = document.createElement('div');
    w.className = 'ds-blk';
    w.appendChild(el.cloneNode(true));
    meas.appendChild(w);
    return w;
  });

  const blks: Blk[] = tpls.map((tpl, i) => {
    const props = src.blocks[i].props;
    const r = tpl.getBoundingClientRect();
    const h = r.height;
    const child = tpl.firstElementChild as HTMLElement | null;
    let cuts: number[] = [];
    if (child?.tagName === 'P' && !props?.keepLines) {
      const lines = lineBoxes(child, r.top);
      const minLines = props?.widowControl === false ? 1 : 2;
      for (let k = minLines; k <= lines.length - minLines; k++) cuts.push((lines[k - 1][1] + lines[k][0]) / 2);
    } else if (child?.tagName === 'TABLE') {
      const rows = [...child.querySelectorAll(':scope > tbody > tr, :scope > tr, :scope > thead > tr')] as HTMLElement[];
      cuts = rows.slice(0, -1).map((row) => row.getBoundingClientRect().bottom - r.top);
    }
    cuts = cuts.filter((c) => c > EPS && c < h - EPS).sort((a, b) => a - b);
    const mt = child ? px(getComputedStyle(child).marginTop) : 0;
    return {
      tpl,
      h,
      cuts,
      mt: mt > 0 && mt < h ? mt : 0,
      keepNext: !!props?.keepNext,
      breakBefore: !!props?.breakBefore,
      breakAfter: !!props?.breakAfter,
      colBreakAfter: !!props?.colBreakAfter,
    };
  });
  meas.remove();
  return { pageW, pageH, pad, cols, gap, colW, contentH, start: src.start, src, blks };
}

interface FillResult {
  cols: Frag[][];
  used: number;
  end: { i: number; from: number };
  pageBreak: boolean;
  placed: boolean;
}

/**
 * Flows blocks from `start` into `n` columns of height `colH`.
 * `canForce`: the columns are full page height, so a block taller than a
 * column is placed anyway (clipped) instead of being pushed forever.
 */
function fill(blks: Blk[], start: { i: number; from: number }, n: number, colH: number, canForce: boolean, pageHasContent: boolean): FillResult {
  let { i, from } = start;
  const cols: Frag[][] = [];
  let used = 0;
  let pageBreak = false;
  let placed = false;

  const firstChunk = (k: number, depth = 0): number => {
    const b = blks[k];
    if (!b) return 0;
    const head = b.cuts.length ? b.cuts[0] : b.h;
    if (b.keepNext && !b.cuts.length && depth < 3) return b.h + firstChunk(k + 1, depth + 1);
    return head;
  };

  for (let c = 0; c < n && !pageBreak; c++) {
    const col: Frag[] = [];
    let y = 0;
    while (i < blks.length) {
      const b = blks[i];
      if (from === 0 && b.breakBefore && (col.length || c > 0 || pageHasContent)) {
        pageBreak = true;
        break;
      }
      // Space before is dropped where the text flows onto a new page or column.
      if (from === 0 && y === 0 && b.mt && i > 0 && !b.breakBefore && (c > 0 || canForce)) from = b.mt;
      const rest = b.h - from;
      const avail = colH - y;
      if (rest <= avail + EPS) {
        // Keep with next: move the chain on unless this is the top of a full-height column.
        const mustPlace = !col.length && canForce;
        if (b.keepNext && !mustPlace && !b.breakAfter && i + 1 < blks.length && rest + firstChunk(i + 1) > avail + EPS) {
          if (from === b.mt) from = 0;
          break;
        }
        col.push({ blk: i, from, to: b.h });
        y += rest;
        i++;
        from = 0;
        placed = true;
        if (b.breakAfter) {
          pageBreak = true;
          break;
        }
        if (b.colBreakAfter) break;
        continue;
      }
      let cut = -1;
      for (const k of b.cuts) if (k > from + EPS && k - from <= avail + EPS) cut = k;
      if (cut > 0) {
        col.push({ blk: i, from, to: cut });
        y += cut - from;
        from = cut;
        placed = true;
        break;
      }
      if (col.length === 0 && canForce) {
        // Taller than a whole column and can't be split: place what fits, or all of it.
        const to = b.cuts.find((k) => k > from + EPS) ?? b.h;
        col.push({ blk: i, from, to });
        y += Math.min(to - from, colH);
        placed = true;
        if (to >= b.h) {
          i++;
          from = 0;
        } else from = to;
      } else if (from === b.mt && !col.some((f) => f.blk === i)) from = 0;
      break;
    }
    cols.push(col);
    used = Math.max(used, y);
  }
  return { cols, used, end: { i, from }, pageBreak, placed };
}

function paginate(secs: Sec[]): PagePlan[] {
  const pages: PagePlan[] = [];
  const cur = { page: null as PagePlan | null, top: 0 };
  const newPage = (sec: number) => {
    cur.page = { sec, regions: [] };
    pages.push(cur.page);
    cur.top = 0;
  };

  secs.forEach((sec, s) => {
    if (!cur.page || sec.start === 'nextPage') newPage(s);
    if (!sec.blks.length) return;
    const nextContinuous = s + 1 < secs.length && secs[s + 1].start !== 'nextPage';
    let state = { i: 0, from: 0 };
    for (let guard = 0; state.i < sec.blks.length && guard < 10000; guard++) {
      const page = cur.page!;
      const avail = secs[page.sec].contentH - cur.top;
      const hasContent = page.regions.some((r) => r.cols.some((c) => c.length));
      if (avail < 4) {
        newPage(s);
        continue;
      }
      let r = fill(sec.blks, state, sec.cols, avail, cur.top < EPS, hasContent);
      // Balance the columns before a continuous section break, like Word.
      if (sec.cols > 1 && nextContinuous && r.end.i >= sec.blks.length && !r.pageBreak) {
        let lo = 0;
        let hi = r.used;
        for (let k = 0; k < 18 && hi - lo > 0.5; k++) {
          const mid = (lo + hi) / 2;
          const t = fill(sec.blks, state, sec.cols, mid, false, hasContent);
          if (t.end.i >= sec.blks.length && !t.pageBreak) {
            r = t;
            hi = mid;
          } else lo = mid;
        }
      }
      if (!r.placed) {
        if (cur.top > EPS || hasContent) {
          newPage(s);
          continue;
        }
        break;
      }
      page.regions.push({ sec: s, top: cur.top, cols: r.cols });
      cur.top += r.used;
      state = r.end;
      if (r.pageBreak || state.i < sec.blks.length) newPage(s);
    }
  });
  return pages;
}

/* ------------------------------------------------------------------ */
/* Building page elements                                              */
/* ------------------------------------------------------------------ */

export interface DocxLayout {
  pages: HTMLElement[];
  /** Page sizes in CSS px. */
  sizes: { w: number; h: number }[];
  dispose(): void;
}

function fragEl(b: Blk, f: Frag, continued: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ds-frag';
  el.style.height = `${f.to - f.from}px`;
  const inner = b.tpl.cloneNode(true) as HTMLElement;
  inner.style.marginTop = `${-f.from}px`;
  if (continued) {
    // A list paragraph continued from the previous column must not count twice.
    inner.querySelectorAll<HTMLElement>('*').forEach((e) => {
      e.style.counterIncrement = 'none';
      e.style.counterReset = 'none';
    });
    const first = inner.firstElementChild as HTMLElement | null;
    if (first) {
      first.style.counterIncrement = 'none';
      first.style.counterReset = 'none';
    }
  }
  el.appendChild(inner);
  return el;
}

function headerFooter(src: HTMLElement, sec: Sec, which: 'header' | 'footer', pageNo: number, total: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ds-hf';
  el.style.left = `${sec.pad[3]}px`;
  el.style.width = `${sec.pageW - sec.pad[1] - sec.pad[3]}px`;
  if (which === 'header') el.style.top = `${sec.src.headerDist}px`;
  else el.style.bottom = `${sec.src.footerDist}px`;
  const clone = src.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  clone.style.height = 'auto';
  clone.style.minHeight = '0';
  clone.querySelectorAll<HTMLElement>('[data-ds-field]').forEach((f) => (f.textContent = String(f.dataset.dsField === 'PAGE' ? pageNo : total)));
  el.appendChild(clone);
  return el;
}

export function layoutDocx(doc: RenderedDocx, override: PageOverride): DocxLayout {
  const root = document.createElement('div');
  doc.host.appendChild(root);
  const secs = doc.sections.map((s) => measureSection(s, override, root));
  const plans = paginate(secs);
  if (!plans.length) plans.push({ sec: 0, regions: [] });

  const seen = new Set<string>();
  const pages = plans.map((plan, pageIndex) => {
    const ps = secs[plan.sec] ?? secs[0];
    const page = document.createElement('div');
    page.className = 'docx ds-page';
    page.style.width = `${ps?.pageW ?? 816}px`;
    page.style.height = `${ps?.pageH ?? 1056}px`;
    for (const region of plan.regions) {
      const sec = secs[region.sec];
      region.cols.forEach((frags, c) => {
        if (!frags.length) return;
        const col = document.createElement('div');
        col.className = 'ds-col';
        col.style.left = `${ps.pad[3] + c * (sec.colW + sec.gap)}px`;
        col.style.top = `${ps.pad[0] + region.top}px`;
        col.style.width = `${sec.colW}px`;
        frags.forEach((f) => {
          const key = `${region.sec}:${f.blk}`;
          col.appendChild(fragEl(sec.blks[f.blk], f, seen.has(key)));
          seen.add(key);
        });
        page.appendChild(col);
      });
    }
    if (ps?.src.header) page.appendChild(headerFooter(ps.src.header, ps, 'header', pageIndex + 1, plans.length));
    if (ps?.src.footer) page.appendChild(headerFooter(ps.src.footer, ps, 'footer', pageIndex + 1, plans.length));
    root.appendChild(page);
    return page;
  });

  return {
    pages,
    sizes: plans.map((p) => ({ w: secs[p.sec]?.pageW ?? 816, h: secs[p.sec]?.pageH ?? 1056 })),
    dispose: () => root.remove(),
  };
}

/* ------------------------------------------------------------------ */
/* PDF output                                                          */
/* ------------------------------------------------------------------ */

interface FontKitFont {
  hasGlyphForCodePoint(cp: number): boolean;
  unitsPerEm: number;
  ascent: number;
  descent: number;
}

interface TextStyle {
  face: Face;
  variant: number; // index into FACE_FILES
  size: number; // px
  color: [number, number, number];
  transform: string;
  smallCaps: boolean;
  letterSpacing: number;
  decorations: Set<string>;
}

function parseColor(c: string): [number, number, number, number] | null {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const a = parts.length > 3 ? parts[3] : 1;
  if (!(a > 0)) return null;
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255, a];
}

const INVISIBLE = new RegExp(`[${charClass([[0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]])}]`, 'g');

export async function layoutToPdf(layout: DocxLayout, report: (value: number, label: string) => void, title?: string): Promise<Blob> {
  const [pdfLib, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, PDFString } = pdfLib;
  const pdf: PDFDocument = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setProducer('Docsmith');
  pdf.setCreator('Docsmith');
  if (title) pdf.setTitle(title);

  const fileCache = new Map<string, Promise<ArrayBuffer>>();
  const fetchFont = (file: string) => {
    let p = fileCache.get(file);
    if (!p) {
      p = fetch(fontUrl(file)).then((r) => {
        if (!r.ok) throw new Error(`Font ${file} could not be loaded.`);
        return r.arrayBuffer();
      });
      fileCache.set(file, p);
    }
    return p;
  };
  const pdfFonts = new Map<string, Promise<{ font: PDFFont; kit: FontKitFont }>>();
  const getFont = (face: Face, variant: number) => {
    const file = FACE_FILES[face][variant];
    let p = pdfFonts.get(file);
    if (!p) {
      p = fetchFont(file).then(async (bytes) => ({
        font: await pdf.embedFont(bytes, { subset: true }),
        kit: (fontkit as unknown as { create(b: Uint8Array): FontKitFont }).create(new Uint8Array(bytes)),
      }));
      pdfFonts.set(file, p);
    }
    return p;
  };

  const images = new Map<string, Promise<PDFImage | null>>();
  const getImage = (src: string, el: HTMLImageElement | SVGSVGElement, w: number, h: number) => {
    let p = images.get(src);
    if (!p) {
      p = (async () => {
        try {
          if (/^data:image\/png/i.test(src)) return await pdf.embedPng(src);
          if (/^data:image\/jpe?g/i.test(src)) return await pdf.embedJpg(src);
          // Anything else the browser can draw (GIF, BMP, WEBP, SVG…) → PNG.
          const canvas = document.createElement('canvas');
          const scale = 3;
          let img: CanvasImageSource;
          let iw = w;
          let ih = h;
          if (el instanceof HTMLImageElement) {
            if (imageBroken(el)) return null;
            img = el;
            iw = el.naturalWidth || w;
            ih = el.naturalHeight || h;
          } else {
            const svg = new XMLSerializer().serializeToString(el);
            const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            const i = new Image();
            await new Promise((res, rej) => ((i.onload = res), (i.onerror = rej), (i.src = url)));
            img = i;
            iw = w * scale;
            ih = h * scale;
          }
          canvas.width = Math.max(1, Math.round(iw));
          canvas.height = Math.max(1, Math.round(ih));
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          const png = canvas.toDataURL('image/png');
          canvas.width = canvas.height = 0;
          return await pdf.embedPng(png);
        } catch {
          return null;
        }
      })();
      images.set(src, p);
    }
    return p;
  };

  // Baseline position inside a text box. The box spans the font's ascent +
  // descent (rounded by the browser), so centre the font's own metrics in it.
  const baselineIn = (r: DOMRect, st: TextStyle, kit: FontKitFont) => {
    const asc = (kit.ascent / kit.unitsPerEm) * st.size;
    const desc = (-kit.descent / kit.unitsPerEm) * st.size;
    return r.top + (r.height - asc - desc) / 2 + asc;
  };

  const styleCache = new Map<Element, TextStyle>();
  const textStyle = (el: Element): TextStyle => {
    let st = styleCache.get(el);
    if (!st) {
      const cs = getComputedStyle(el);
      const face = faceForFamily(cs.fontFamily);
      const bold = (parseInt(cs.fontWeight) || 400) >= 600;
      const italic = cs.fontStyle !== 'normal';
      const decorations = new Set<string>();
      for (let e: Element | null = el; e && !e.classList.contains('ds-blk') && !e.classList.contains('ds-page'); e = e.parentElement) {
        getComputedStyle(e).textDecorationLine.split(' ').forEach((d) => d !== 'none' && decorations.add(d));
        if (getComputedStyle(e).display === 'block') break;
      }
      const c = parseColor(cs.color) ?? [0, 0, 0, 1];
      st = {
        face,
        variant: (bold ? 1 : 0) + (italic ? 2 : 0),
        size: px(cs.fontSize),
        color: [c[0], c[1], c[2]],
        transform: cs.textTransform,
        smallCaps: cs.fontVariantCaps === 'small-caps' || /small-caps/.test(cs.fontVariant),
        letterSpacing: px(cs.letterSpacing),
        decorations,
      };
      styleCache.set(el, st);
    }
    return st;
  };

  const range = document.createRange();

  for (let pi = 0; pi < layout.pages.length; pi++) {
    report(pi / layout.pages.length, `Writing page ${pi + 1} of ${layout.pages.length}…`);
    const pageEl = layout.pages[pi];
    const size = layout.sizes[pi];
    const page: PDFPage = pdf.addPage([size.w * PT, size.h * PT]);
    const origin = pageEl.getBoundingClientRect();
    const H = size.h * PT;
    const X = (x: number) => (x - origin.left) * PT;
    const Y = (y: number) => H - (y - origin.top) * PT;

    // Visible area (CSS px, page coordinates) for skipping clipped content.
    const clipStack: DOMRect[] = [new DOMRect(origin.left, origin.top, size.w, size.h)];
    const visible = (r: DOMRect) => {
      const c = clipStack[clipStack.length - 1];
      const cy = r.top + r.height / 2;
      return r.right > c.left + 0.5 && r.left < c.right - 0.5 && cy > c.top && cy < c.bottom;
    };
    const intersects = (r: DOMRect) => {
      const c = clipStack[clipStack.length - 1];
      return r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom;
    };

    const drawText = async (node: Text) => {
      const raw = node.data;
      if (!raw.trim()) return;
      const el = node.parentElement!;
      const st = textStyle(el);
      if (st.size <= 0) return;
      const primary = await getFont(st.face, st.variant);
      const needFallback = [...raw].some((ch) => ch.trim() && !primary.kit.hasGlyphForCodePoint(ch.codePointAt(0)!));
      const fallback = needFallback ? await getFont('fallback', st.variant & 1) : null;
      const color = rgb(...st.color);

      const transform = (s: string) => {
        s = s.replace(INVISIBLE, '');
        if (st.transform === 'uppercase') return s.toUpperCase();
        if (st.transform === 'lowercase') return s.toLowerCase();
        if (st.transform === 'capitalize') return s.replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());
        return s;
      };

      type Glyph = { t: string; size: number; font: PDFFont; w: number };
      const glyphsOf = (text: string): Glyph[] =>
        [...text].map((ch) => {
          const small = st.smallCaps && ch !== ch.toUpperCase();
          const t = small ? ch.toUpperCase() : ch;
          const size = (small ? st.size * 0.7 : st.size) * PT;
          const font = (fallback && !primary.kit.hasGlyphForCodePoint(t.codePointAt(0)!) ? fallback : primary).font;
          return { t, size, font, w: font.widthOfTextAtSize(t, size) + st.letterSpacing * PT };
        });

      // Draws `text` from x (pt) on baseline y (pt). When the browser laid the
      // word out wider or narrower (synthetic small caps, letter spacing), the
      // characters are spread to fill exactly the same box.
      const drawRun = (text: string, x: number, y: number, target: number) => {
        const glyphs = glyphsOf(text);
        if (!glyphs.length) return;
        const natural = glyphs.reduce((n, g) => n + g.w, 0);
        const factor = natural > 0 ? target / natural : 1;
        if (glyphs.length > 1 && Math.abs(factor - 1) > 0.015) {
          let cx = x;
          for (const g of glyphs) {
            page.drawText(g.t, { x: cx, y, size: g.size, font: g.font, color });
            cx += g.w * factor;
          }
          return;
        }
        // Group runs that share a font and size into one text operation.
        let cx = x;
        for (let i = 0; i < glyphs.length; ) {
          let j = i;
          let t = '';
          let w = 0;
          while (j < glyphs.length && glyphs[j].font === glyphs[i].font && glyphs[j].size === glyphs[i].size) {
            t += glyphs[j].t;
            w += glyphs[j].w;
            j++;
          }
          page.drawText(t, { x: cx, y, size: glyphs[i].size, font: glyphs[i].font, color });
          cx += w;
          i = j;
        }
      };

      const re = /\S+/g;
      for (let m = re.exec(raw); m; m = re.exec(raw)) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
        if (!rects.length) continue;
        if (rects.length === 1) {
          const r = rects[0];
          if (!visible(r)) continue;
          const t = transform(m[0]);
          if (t) drawRun(t, X(r.left), Y(baselineIn(r, st, primary.kit)), r.width * PT);
          continue;
        }
        // The word wraps across lines: place it character by character.
        let i = 0;
        for (const ch of m[0]) {
          range.setStart(node, m.index + i);
          range.setEnd(node, m.index + i + ch.length);
          i += ch.length;
          const r = range.getBoundingClientRect();
          if (!r.width || !visible(r)) continue;
          const t = transform(ch);
          if (t) drawRun(t, X(r.left), Y(baselineIn(r, st, primary.kit)), r.width * PT);
        }
      }

      if (st.decorations.size) {
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (!visible(r) || r.width < 0.5) continue;
          const thick = Math.max(0.5, st.size * PT * 0.06);
          const base = baselineIn(r, st, primary.kit);
          const lines: number[] = [];
          if (st.decorations.has('underline')) lines.push(base + st.size * 0.12);
          if (st.decorations.has('line-through')) lines.push(base - st.size * 0.28);
          if (st.decorations.has('overline')) lines.push(r.top);
          for (const ly of lines) page.drawLine({ start: { x: X(r.left), y: Y(ly) }, end: { x: X(r.right), y: Y(ly) }, thickness: thick, color });
        }
      }
    };

    const drawBox = (el: Element, cs: CSSStyleDeclaration) => {
      const bg = parseColor(cs.backgroundColor);
      const table = (el.tagName === 'TD' || el.tagName === 'TH') && el.closest('table');
      const collapsed = !!table && getComputedStyle(table).borderCollapse === 'collapse';
      const rects = cs.display.startsWith('inline') && cs.display !== 'inline-block' ? [...el.getClientRects()] : [el.getBoundingClientRect()];
      for (const r of rects) {
        if (!r.width || !r.height || !intersects(r)) continue;
        if (bg) page.drawRectangle({ x: X(r.left), y: Y(r.bottom), width: r.width * PT, height: r.height * PT, color: rgb(bg[0], bg[1], bg[2]), opacity: bg[3] });
        const sides: [string, number, number, number, number][] = [
          ['Top', r.left, r.top, r.right, r.top],
          ['Bottom', r.left, r.bottom, r.right, r.bottom],
          ['Left', r.left, r.top, r.left, r.bottom],
          ['Right', r.right, r.top, r.right, r.bottom],
        ];
        for (const [side, x1, y1, x2, y2] of sides) {
          const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
          const width = px(cs.getPropertyValue(`border-${side.toLowerCase()}-width`));
          if (!width || style === 'none' || style === 'hidden') continue;
          const c = parseColor(cs.getPropertyValue(`border-${side.toLowerCase()}-color`));
          if (!c) continue;
          // Collapsed table borders are centred on the shared cell edge; other
          // borders lie inside the box.
          const inset = collapsed ? 0 : width / 2;
          const dx = side === 'Left' ? inset : side === 'Right' ? -inset : 0;
          const dy = side === 'Top' ? inset : side === 'Bottom' ? -inset : 0;
          page.drawLine({
            start: { x: X(x1 + dx), y: Y(y1 + dy) },
            end: { x: X(x2 + dx), y: Y(y2 + dy) },
            thickness: width * PT,
            color: rgb(c[0], c[1], c[2]),
            opacity: c[3],
            dashArray: style === 'dashed' ? [width * PT * 3, width * PT * 2] : style === 'dotted' ? [width * PT, width * PT] : undefined,
          });
        }
      }
    };

    const walk = async (el: Element): Promise<void> => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const tag = el.tagName;
      if (tag === 'STYLE' || tag === 'SCRIPT') return;
      if (el !== pageEl) drawBox(el, cs);

      if (tag === 'IMG' || el instanceof SVGSVGElement) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || !intersects(r)) return;
        const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : `svg:${el.outerHTML}`;
        const img = await getImage(src, el as HTMLImageElement | SVGSVGElement, r.width, r.height);
        if (img) page.drawImage(img, { x: X(r.left), y: Y(r.bottom), width: r.width * PT, height: r.height * PT });
        return;
      }

      if (tag === 'A') {
        const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
        if (/^(https?:|mailto:)/i.test(href)) {
          for (const r of el.getClientRects()) {
            if (!r.width || !visible(r)) continue;
            const annot = pdf.context.obj({
              Type: 'Annot',
              Subtype: 'Link',
              Rect: [X(r.left), Y(r.bottom), X(r.right), Y(r.top)],
              Border: [0, 0, 0],
              A: { Type: 'Action', S: 'URI', URI: PDFString.of(href) },
            });
            page.node.addAnnot(pdf.context.register(annot));
          }
        }
      }

      const clips = el !== pageEl && cs.overflow !== 'visible' && cs.overflowX !== 'visible';
      if (clips) {
        const r = el.getBoundingClientRect();
        const c = clipStack[clipStack.length - 1];
        const left = Math.max(r.left, c.left);
        const top = Math.max(r.top, c.top);
        const right = Math.min(r.right, c.right);
        const bottom = Math.min(r.bottom, c.bottom);
        if (right <= left || bottom <= top) return;
        clipStack.push(new DOMRect(left, top, right - left, bottom - top));
        page.pushOperators(pushGraphicsState(), rectangle(X(left), Y(bottom), (right - left) * PT, (bottom - top) * PT), clip(), endPath());
      }
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) await drawText(child as Text);
        else if (child.nodeType === Node.ELEMENT_NODE) await walk(child as Element);
      }
      if (clips) {
        clipStack.pop();
        page.pushOperators(popGraphicsState());
      }
    };

    await walk(pageEl);
    await new Promise((r) => setTimeout(r, 0));
  }

  report(0.97, 'Saving PDF…');
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/* ------------------------------------------------------------------ */
/* Browser print (for scripts the bundled fonts don't cover)           */
/* ------------------------------------------------------------------ */

export function printLayout(layout: DocxLayout, doc: RenderedDocx) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const first = layout.sizes[0] ?? { w: 816, h: 1056 };
  const docStyles = [...doc.host.querySelectorAll('style')].map((s) => s.outerHTML).join('');
  const pages = layout.pages.map((p) => p.outerHTML).join('');
  const d = iframe.contentDocument!;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Document</title>${docStyles}<style>${fontFaceCss()}${LAYOUT_CSS}
    @page { size: ${first.w * PT}pt ${first.h * PT}pt; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .ds-page { break-after: page; page-break-after: always; }
    .ds-page:last-child { break-after: auto; page-break-after: auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style></head><body>${pages}</body></html>`);
  d.close();
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60_000);
  };
  (iframe.contentDocument?.fonts?.ready ?? Promise.resolve()).then(() => setTimeout(go, 200));
}
