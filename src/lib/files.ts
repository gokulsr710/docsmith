export interface OutputFile {
  name: string;
  blob: Blob;
}

let counter = 0;
export const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function percentSaved(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 100);
}

export function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function fileFormat(file: File): string {
  const ext = extOf(file.name);
  if (ext) return ext.toUpperCase();
  return (file.type.split('/')[1] || 'file').toUpperCase();
}

export type AcceptKind = 'pdf' | 'image' | 'jpg' | 'png' | 'webp';

const JPG = { mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg'], exts: ['jpg', 'jpeg', 'jfif'] };
const PNG = { mimes: ['image/png'], exts: ['png'] };
const WEBP = { mimes: ['image/webp'], exts: ['webp'] };

const KIND_RULES: Record<AcceptKind, { mimes: string[]; exts: string[] }> = {
  pdf: { mimes: ['application/pdf'], exts: ['pdf'] },
  jpg: JPG,
  png: PNG,
  webp: WEBP,
  image: { mimes: [...JPG.mimes, ...PNG.mimes, ...WEBP.mimes], exts: [...JPG.exts, ...PNG.exts, ...WEBP.exts] },
};

export function acceptAttr(kinds: AcceptKind[]): string {
  const parts = new Set<string>();
  kinds.forEach((k) => {
    KIND_RULES[k].mimes.forEach((m) => parts.add(m));
    KIND_RULES[k].exts.forEach((e) => parts.add(`.${e}`));
  });
  return [...parts].join(',');
}

export function matchesKind(file: File, kinds: AcceptKind[]): boolean {
  const ext = extOf(file.name);
  const type = file.type.toLowerCase();
  return kinds.some((k) => KIND_RULES[k].mimes.includes(type) || KIND_RULES[k].exts.includes(ext));
}

export function acceptLabel(kinds: AcceptKind[]): string {
  const labels: Record<AcceptKind, string> = { pdf: 'PDF', image: 'JPG, PNG, WEBP', jpg: 'JPG', png: 'PNG', webp: 'WEBP' };
  return kinds.map((k) => labels[k]).join(', ');
}

export const MAX_FILE_SIZE = 200 * 1024 * 1024;

export function partitionFiles(files: File[], kinds: AcceptKind[]) {
  const valid: File[] = [];
  const rejected: { file: File; reason: string }[] = [];
  for (const f of files) {
    if (!matchesKind(f, kinds)) rejected.push({ file: f, reason: `Unsupported format. Use ${acceptLabel(kinds)}.` });
    else if (f.size === 0) rejected.push({ file: f, reason: 'The file is empty.' });
    else if (f.size > MAX_FILE_SIZE) rejected.push({ file: f, reason: `File is larger than ${formatBytes(MAX_FILE_SIZE)}.` });
    else valid.push(f);
  }
  return { valid, rejected };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before releasing the reference.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Ensures file names inside a ZIP are unique. */
export function uniqueNames(files: OutputFile[]): OutputFile[] {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const n = seen.get(f.name) ?? 0;
    seen.set(f.name, n + 1);
    if (n === 0) return f;
    const ext = extOf(f.name);
    return { ...f, name: `${baseName(f.name)} (${n})${ext ? '.' + ext : ''}` };
  });
}

export async function zipFiles(files: OutputFile[], onProgress?: (p: number) => void): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  uniqueNames(files).forEach((f) => zip.file(f.name, f.blob));
  // Images and PDFs are already compressed, so storing is much faster with near-identical size.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) => onProgress?.(meta.percent / 100));
}

/** Yields to the event loop so progress UI can paint during long loops. */
export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong while processing your file.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
