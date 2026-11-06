import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileText,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  MousePointerClick,
  Search,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserX,
  X,
  Zap,
} from 'lucide-react';
import { Dropzone } from '../components/ui/Dropzone';
import { Button } from '../components/ui/Button';
import { ToolGrid } from '../components/ToolCard';
import { useSession } from '../context/session';
import { useToast } from '../context/toast';
import { acceptAttr, formatBytes, matchesKind, pluralize } from '../lib/files';
import { saveFile } from '../lib/inapp';
import { POPULAR_TOOLS, TOOLS, getTool, searchTools, type Tool, type ToolCategory } from '../lib/tools';
import { usePageMeta } from '../lib/seo';

export default function Home() {
  usePageMeta('', 'Free online PDF and image tools: Image to PDF, merge, split and compress PDF, convert JPG/PNG/WEBP, resize and compress images. 100% in your browser — files never leave your device.');
  const [pending, setPending] = useState<File[] | null>(null);
  const toast = useToast();

  const onFiles = (files: File[]) => {
    const supported = files.filter((f) => matchesKind(f, ['pdf', 'image', 'docx']));
    if (supported.length < files.length) toast.error(`${files.length - supported.length} unsupported file(s) skipped`, 'Upload PDF, Word (.docx), JPG, PNG or WEBP files.');
    if (supported.length) setPending(supported);
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,rgb(99_91_255/0.16),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgb(99_91_255/0.24),transparent_60%)]"
        />
        <div className="mx-auto max-w-4xl px-4 pt-10 pb-14 text-center sm:px-6 sm:pt-16 sm:pb-20">
          <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <span className="size-1.5 rounded-full bg-emerald-500" /> 100% free · No sign-up · Files stay on your device
          </p>
          <h1 className="mt-5 animate-fade-up text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            All Your PDF &amp; Image Tools <span className="bg-gradient-to-r from-brand-600 to-accent-600 dark:from-brand-400 dark:to-accent-400 bg-clip-text text-transparent">in One Place</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl animate-fade-up text-base text-pretty text-slate-500 sm:mt-5 sm:text-lg dark:text-slate-400">
            Convert, merge, split, compress and edit PDFs and images in seconds. Everything runs right in your browser, so your documents are never uploaded anywhere.
          </p>
          <div className="mx-auto mt-8 max-w-2xl animate-fade-up text-left sm:mt-10">
            {pending ? (
              <ToolChooser files={pending} onCancel={() => setPending(null)} />
            ) : (
              <Dropzone accept={acceptAttr(['pdf', 'image', 'docx'])} onFiles={onFiles} size="lg" title="drop PDFs or images here" hint="PDF, Word, JPG, PNG and WEBP supported" />
            )}
          </div>
        </div>
      </section>

      <RecentFiles />

      {/* Popular tools */}
      <Section id="popular" eyebrow="Popular" title="Most-used tools" subtitle="The tools people reach for every day.">
        <ToolGrid tools={POPULAR_TOOLS} wide />
      </Section>

      {/* How it works */}
      <Section eyebrow="How it works" title="Three steps. No learning curve.">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Upload, title: 'Upload your files', text: 'Drag and drop or pick files from your computer or phone.' },
            { icon: SlidersHorizontal, title: 'Customize your settings', text: 'Reorder, rotate, choose page size, quality and more.' },
            { icon: Download, title: 'Download your files', text: 'Get your result instantly — or a ZIP when there are many.' },
          ].map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="absolute top-6 right-6 text-5xl font-black text-slate-100 dark:text-white/5">{i + 1}</span>
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <AllTools />

      {/* Features */}
      <Section eyebrow="Why Docsmith" title="Built for speed and privacy">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Zap, title: 'Fast processing', text: 'No upload or download wait — work starts instantly on your device.' },
            { icon: UserX, title: 'No registration', text: 'No accounts, no emails, no watermarks. Just open and use.' },
            { icon: Lock, title: 'Privacy-focused', text: 'Files are processed locally and never sent to a server.' },
            { icon: Smartphone, title: 'Mobile-friendly', text: 'Works great on phones and tablets, with touch-friendly controls.' },
            { icon: MousePointerClick, title: 'Simple interface', text: 'Clean, focused tools that anyone can use without instructions.' },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <f.icon className="size-6 text-brand-600 dark:text-brand-400" aria-hidden />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-slate-900 p-8 text-white sm:p-10 md:flex-row md:items-center dark:bg-white/[0.06]">
          <ShieldCheck className="size-12 shrink-0 text-emerald-400" aria-hidden />
          <div className="flex-1">
            <h2 className="text-xl font-bold sm:text-2xl">Your files never leave your device</h2>
            <p className="mt-2 max-w-2xl text-slate-300">
              Docsmith uses your browser’s own engine to read and write PDFs and images. Nothing is uploaded, nothing is stored. Close the tab and every file is gone.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function Section({ id, eyebrow, title, subtitle, children, actions }: { id?: string; eyebrow: string; title: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto mt-16 max-w-7xl scroll-mt-24 px-4 sm:mt-24 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-2 text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function AllTools() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ToolCategory | 'all'>('all');
  const results = useMemo(() => searchTools(query, category), [query, category]);
  const tabs: { value: ToolCategory | 'all'; label: string; icon: typeof LayoutGrid }[] = [
    { value: 'all', label: 'All tools', icon: LayoutGrid },
    { value: 'pdf', label: 'PDF', icon: FileText },
    { value: 'image', label: 'Image', icon: ImageIcon },
  ];

  return (
    <Section
      id="tools"
      eyebrow="Toolbox"
      title="Every tool you need"
      subtitle={`${TOOLS.length} tools for PDFs and images.`}
      actions={
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools…" className="input pl-9" aria-label="Search tools" />
        </div>
      }
    >
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tool categories">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={category === t.value}
            onClick={() => setCategory(t.value)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
              category === t.value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
            }`}
          >
            <t.icon className="size-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      {results.length ? (
        <ToolGrid tools={results} />
      ) : (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <Search className="size-8 text-slate-300" aria-hidden />
          <p className="mt-3 font-semibold">No tools found</p>
          <p className="mt-1 text-sm text-slate-500">Try a different keyword like “merge” or “png”.</p>
        </div>
      )}
    </Section>
  );
}

/** After dropping files on the homepage, suggest the tools that can handle them. */
function ToolChooser({ files, onCancel }: { files: File[]; onCancel: () => void }) {
  const { setHandoff } = useSession();
  const navigate = useNavigate();
  const pdfs = files.filter((f) => matchesKind(f, ['pdf']));
  const images = files.filter((f) => matchesKind(f, ['image']));
  const words = files.filter((f) => matchesKind(f, ['docx']));

  let suggestions: { tool: Tool; files: File[] }[] = [];
  if (words.length) suggestions.push({ tool: getTool('word-to-pdf'), files: words.slice(0, 1) });
  if (images.length) {
    suggestions.push({ tool: getTool('image-to-pdf'), files: images });
    suggestions.push({ tool: getTool('compress-image'), files: images });
    suggestions.push({ tool: getTool('resize-image'), files: images });
    if (images.some((f) => matchesKind(f, ['jpg']))) suggestions.push({ tool: getTool('jpg-to-png'), files: images.filter((f) => matchesKind(f, ['jpg'])) });
    if (images.some((f) => matchesKind(f, ['png']))) suggestions.push({ tool: getTool('png-to-jpg'), files: images.filter((f) => matchesKind(f, ['png'])) });
    if (images.some((f) => matchesKind(f, ['webp']))) suggestions.push({ tool: getTool('webp-to-jpg'), files: images.filter((f) => matchesKind(f, ['webp'])) });
    suggestions.push({ tool: getTool('rotate-image'), files: images });
    if (images.length === 1) suggestions.push({ tool: getTool('crop-image'), files: images });
  }
  if (pdfs.length) {
    if (pdfs.length > 1) suggestions.push({ tool: getTool('merge-pdf'), files: pdfs });
    suggestions.push(
      ...['pdf-to-word', 'compress-pdf', 'pdf-to-jpg', 'split-pdf', 'rotate-pdf', 'organize-pdf', 'delete-pages', 'extract-images'].map((id) => ({ tool: getTool(id), files: pdfs.slice(0, 1) })),
    );
    if (pdfs.length === 1) suggestions.push({ tool: getTool('merge-pdf'), files: pdfs });
  }
  suggestions = suggestions.slice(0, 9);

  const pick = (s: { tool: Tool; files: File[] }) => {
    setHandoff(s.files);
    navigate(s.tool.path);
  };

  const summary = [pdfs.length && pluralize(pdfs.length, 'PDF'), words.length && pluralize(words.length, 'Word file'), images.length && pluralize(images.length, 'image')].filter(Boolean).join(' and ');

  return (
    <div className="card animate-scale-in p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">What would you like to do?</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {summary} selected · {formatBytes(files.reduce((s, f) => s + f.size, 0))}
          </p>
        </div>
        <button onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cancel and choose different files">
          <X className="size-5" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((s) => {
          const Icon = s.tool.icon;
          return (
            <button
              key={s.tool.id}
              onClick={() => pick(s)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/10 dark:hover:bg-brand-500/10"
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${s.tool.tint}`}>
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{s.tool.title}</span>
            </button>
          );
        })}
      </div>
      {pdfs.length > 1 && <p className="mt-3 text-xs text-slate-500">Single-file PDF tools will use the first PDF: {pdfs[0].name}</p>}
    </div>
  );
}

function RecentFiles() {
  const { recent, clearRecent } = useSession();
  if (!recent.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="recent-heading">
      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-slate-400" aria-hidden /> Recent files <span className="font-normal text-slate-400">(this session only)</span>
          </h2>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={clearRecent}>
            Clear
          </Button>
        </div>
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {recent.map((r) => (
            <li key={r.id} className="w-56 shrink-0">
              <button
                onClick={() => saveFile(r.blob, r.name)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 dark:border-white/10"
                title={`Download ${r.name}`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10">
                  {r.blob.type === 'application/pdf' ? <FileText className="size-4" /> : <ImageIcon className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatBytes(r.size)} · {TOOLS.find((t) => t.id === r.toolId)?.title}
                  </span>
                </span>
                <Download className="size-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
