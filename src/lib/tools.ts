import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownUp,
  Combine,
  Crop,
  FileImage,
  FileMinus,
  FileOutput,
  FileStack,
  FileText,
  FileType,
  ImageDown,
  Images,
  Minimize2,
  Repeat,
  RotateCw,
  Scaling,
  Scissors,
  Shrink,
  RotateCcwSquare,
} from 'lucide-react';

export type ToolCategory = 'pdf' | 'image';

export interface Tool {
  id: string;
  path: string;
  title: string;
  description: string;
  categories: ToolCategory[];
  icon: LucideIcon;
  /** Tailwind classes for the icon tile. */
  tint: string;
  keywords: string;
  popular?: boolean;
}

const RED = 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400';
const ORANGE = 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400';
const AMBER = 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
const GREEN = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
const BLUE = 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400';
const INDIGO = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400';
const VIOLET = 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400';
const PINK = 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400';

export const TOOLS: Tool[] = [
  {
    id: 'image-to-pdf',
    path: '/image-to-pdf',
    title: 'Image to PDF',
    description: 'Combine JPG, PNG and WEBP images into a single PDF document.',
    categories: ['pdf', 'image'],
    icon: FileImage,
    tint: RED,
    keywords: 'jpg png webp photo picture combine images convert to pdf',
    popular: true,
  },
  {
    id: 'word-to-pdf',
    path: '/word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert Word documents (.docx) into PDF files that keep the original layout.',
    categories: ['pdf'],
    icon: FileText,
    tint: BLUE,
    keywords: 'word docx doc office document convert to pdf layout columns ieee paper',
    popular: true,
  },
  {
    id: 'pdf-to-word',
    path: '/pdf-to-word',
    title: 'PDF to Word',
    description: 'Turn PDFs into editable Word documents (.docx).',
    categories: ['pdf'],
    icon: FileType,
    tint: INDIGO,
    keywords: 'pdf to word docx doc editable convert office',
    popular: true,
  },
  {
    id: 'pdf-to-jpg',
    path: '/pdf-to-jpg',
    title: 'PDF to JPG',
    description: 'Turn every PDF page into a high-quality JPG image.',
    categories: ['pdf'],
    icon: ImageDown,
    tint: AMBER,
    keywords: 'pdf to image jpeg convert pages export',
    popular: true,
  },
  {
    id: 'pdf-to-png',
    path: '/pdf-to-png',
    title: 'PDF to PNG',
    description: 'Export PDF pages as lossless PNG images.',
    categories: ['pdf'],
    icon: ImageDown,
    tint: ORANGE,
    keywords: 'pdf to image png convert pages export',
  },
  {
    id: 'merge-pdf',
    path: '/merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDFs into one file in the order you want.',
    categories: ['pdf'],
    icon: Combine,
    tint: INDIGO,
    keywords: 'combine join append pdfs',
    popular: true,
  },
  {
    id: 'split-pdf',
    path: '/split-pdf',
    title: 'Split PDF',
    description: 'Split a PDF into single pages or custom page ranges.',
    categories: ['pdf'],
    icon: Scissors,
    tint: VIOLET,
    keywords: 'separate extract pages ranges divide',
    popular: true,
  },
  {
    id: 'compress-pdf',
    path: '/compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce PDF file size with adjustable compression levels.',
    categories: ['pdf'],
    icon: Minimize2,
    tint: GREEN,
    keywords: 'reduce shrink optimize size smaller',
    popular: true,
  },
  {
    id: 'rotate-pdf',
    path: '/rotate-pdf',
    title: 'Rotate PDF',
    description: 'Rotate all pages or just the ones you choose.',
    categories: ['pdf'],
    icon: RotateCw,
    tint: BLUE,
    keywords: 'turn orientation pages landscape portrait',
  },
  {
    id: 'organize-pdf',
    path: '/organize-pdf',
    title: 'Reorder Pages',
    description: 'Drag and drop to rearrange the pages of a PDF.',
    categories: ['pdf'],
    icon: ArrowDownUp,
    tint: PINK,
    keywords: 'reorder sort rearrange organize move pages order',
  },
  {
    id: 'delete-pages',
    path: '/delete-pages',
    title: 'Delete Pages',
    description: 'Remove unwanted pages from a PDF document.',
    categories: ['pdf'],
    icon: FileMinus,
    tint: RED,
    keywords: 'remove pages erase drop',
  },
  {
    id: 'extract-images',
    path: '/extract-images',
    title: 'Extract Images',
    description: 'Pull out all embedded images from a PDF.',
    categories: ['pdf'],
    icon: FileOutput,
    tint: AMBER,
    keywords: 'get images photos pictures from pdf save',
  },
  {
    id: 'jpg-to-png',
    path: '/jpg-to-png',
    title: 'JPG to PNG',
    description: 'Convert JPG photos to lossless PNG images.',
    categories: ['image'],
    icon: Repeat,
    tint: BLUE,
    keywords: 'jpeg png convert format',
    popular: true,
  },
  {
    id: 'png-to-jpg',
    path: '/png-to-jpg',
    title: 'PNG to JPG',
    description: 'Convert PNG images to smaller JPG files.',
    categories: ['image'],
    icon: Repeat,
    tint: INDIGO,
    keywords: 'png jpeg convert format',
  },
  {
    id: 'webp-to-jpg',
    path: '/webp-to-jpg',
    title: 'WEBP to JPG',
    description: 'Convert WEBP images to widely supported JPG.',
    categories: ['image'],
    icon: Repeat,
    tint: VIOLET,
    keywords: 'webp jpeg convert format',
  },
  {
    id: 'webp-to-png',
    path: '/webp-to-png',
    title: 'WEBP to PNG',
    description: 'Convert WEBP images to lossless PNG.',
    categories: ['image'],
    icon: Repeat,
    tint: PINK,
    keywords: 'webp png convert format',
  },
  {
    id: 'compress-image',
    path: '/compress-image',
    title: 'Image Compressor',
    description: 'Shrink JPG, PNG and WEBP files while keeping quality.',
    categories: ['image'],
    icon: Shrink,
    tint: GREEN,
    keywords: 'compress reduce optimize image size smaller photo',
    popular: true,
  },
  {
    id: 'resize-image',
    path: '/resize-image',
    title: 'Resize Image',
    description: 'Change image dimensions by pixels or percentage.',
    categories: ['image'],
    icon: Scaling,
    tint: ORANGE,
    keywords: 'resize scale dimensions width height smaller bigger',
    popular: true,
  },
  {
    id: 'crop-image',
    path: '/crop-image',
    title: 'Crop Image',
    description: 'Crop images freely or to a fixed aspect ratio.',
    categories: ['image'],
    icon: Crop,
    tint: AMBER,
    keywords: 'crop trim cut aspect ratio square',
  },
  {
    id: 'rotate-image',
    path: '/rotate-image',
    title: 'Rotate Image',
    description: 'Rotate and flip one or many images at once.',
    categories: ['image'],
    icon: RotateCcwSquare,
    tint: BLUE,
    keywords: 'rotate flip mirror turn image',
  },
];

export const getTool = (id: string) => {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown tool ${id}`);
  return t;
};

export const POPULAR_TOOLS = ['image-to-pdf', 'word-to-pdf', 'pdf-to-word', 'pdf-to-jpg', 'merge-pdf', 'compress-pdf', 'split-pdf', 'jpg-to-png', 'compress-image', 'resize-image'].map(getTool);

export function searchTools(query: string, category?: ToolCategory | 'all'): Tool[] {
  const q = query.trim().toLowerCase();
  return TOOLS.filter((t) => {
    if (category && category !== 'all' && !t.categories.includes(category)) return false;
    if (!q) return true;
    const hay = `${t.title} ${t.description} ${t.keywords}`.toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

export const CATEGORY_ICONS: Record<ToolCategory, LucideIcon> = { pdf: FileStack, image: Images };
