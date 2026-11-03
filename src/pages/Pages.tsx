import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Cpu, FileQuestion, Mail, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { ToolGrid } from '../components/ToolCard';
import { Button, ButtonLink, buttonClass } from '../components/ui/Button';
import { Field } from '../components/ui/controls';
import { CATEGORY_ICONS, TOOLS, type ToolCategory } from '../lib/tools';
import { CONTACT_EMAIL, SITE_NAME, usePageMeta } from '../lib/seo';

export function CategoryPage({ category }: { category: ToolCategory }) {
  const title = category === 'pdf' ? 'PDF Tools' : 'Image Tools';
  const description =
    category === 'pdf'
      ? 'Merge, split, compress, rotate and convert PDF files — free and private, right in your browser.'
      : 'Convert, compress, resize, crop and rotate JPG, PNG and WEBP images — free and private, right in your browser.';
  usePageMeta(title, description);
  const Icon = CATEGORY_ICONS[category];
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <header className="mb-8 max-w-2xl">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{description}</p>
      </header>
      <ToolGrid tools={TOOLS.filter((t) => t.categories.includes(category))} />
    </div>
  );
}

function Prose({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-lg text-slate-500 dark:text-slate-400">{intro}</p>}
      <div className="mt-8 space-y-6 leading-relaxed text-slate-600 dark:text-slate-300 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}

export function About() {
  usePageMeta('About', `${SITE_NAME} is a free, privacy-first toolkit for PDF and image files that runs entirely in your browser.`);
  return (
    <Prose title={`About ${SITE_NAME}`} intro="A fast, private toolkit for everyday document tasks.">
      <p>
        {SITE_NAME} brings the PDF and image tools you use every day — converting images to PDF, merging and splitting documents, compressing files and more — into one clean,
        simple interface that works on any device.
      </p>
      <div className="not-prose grid gap-4 sm:grid-cols-3">
        {[
          { icon: Cpu, title: 'Runs on your device', text: 'All processing uses your browser’s own engine.' },
          { icon: ShieldCheck, title: 'Nothing uploaded', text: 'Your files are never sent to any server.' },
          { icon: Trash2, title: 'Nothing kept', text: 'Files live in memory only until you leave.' },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <f.icon className="size-6 text-brand-600 dark:text-brand-400" aria-hidden />
            <p className="mt-3 font-semibold text-slate-900 dark:text-white">{f.title}</p>
            <p className="mt-1 text-sm">{f.text}</p>
          </div>
        ))}
      </div>
      <h2>How it works</h2>
      <p>
        When you add a file, it is read directly by your browser. PDFs are created and edited with the open-source <strong>pdf-lib</strong> library and rendered with Mozilla’s{' '}
        <strong>PDF.js</strong>. Images are processed with the browser’s built-in Canvas API. The result is generated on your device and handed straight to your downloads folder.
      </p>
      <h2>Good to know</h2>
      <ul>
        <li>Very large files depend on your device’s memory. Phones may struggle with documents of several hundred pages.</li>
        <li>Strong PDF compression converts pages to images, which makes text non-selectable. The basic level keeps text intact.</li>
        <li>Password-protected PDFs must be unlocked before they can be edited.</li>
      </ul>
      <div className="pt-4">
        <ButtonLink to="/" size="lg">
          Explore the tools
        </ButtonLink>
      </div>
    </Prose>
  );
}

export function Privacy() {
  usePageMeta('Privacy Policy', `${SITE_NAME} processes your files locally in your browser. We never upload, store or share your documents.`);
  return (
    <Prose title="Privacy Policy" intro="Short version: your files never leave your device.">
      <h2>Your files</h2>
      <p>
        All file processing happens locally in your web browser. Documents and images you add are never uploaded to our servers or any third party. They are held in your
        browser’s memory only while you use a tool and are released when you start over, clear your files, or close the tab.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Your light/dark theme preference, saved in your browser’s local storage.</li>
        <li>The “Recent files” list exists only in memory for the current tab and disappears when you reload or close it.</li>
      </ul>
      <h2>Analytics and cookies</h2>
      <p>This site does not use tracking cookies or third-party analytics by default. If the site operator adds analytics, this policy should be updated to describe it.</p>
      <h2>Contact</h2>
      <p>
        Questions about privacy? <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" to="/contact">Contact us</Link>.
      </p>
    </Prose>
  );
}

export function Terms() {
  usePageMeta('Terms and Conditions', `Terms and conditions for using ${SITE_NAME}.`);
  return (
    <Prose title="Terms and Conditions">
      <p>By using {SITE_NAME} you agree to these terms. If you do not agree, please do not use the service.</p>
      <h2>Use of the service</h2>
      <ul>
        <li>{SITE_NAME} is provided free of charge for personal and commercial use.</li>
        <li>You are responsible for the files you process and must have the right to use and modify them.</li>
        <li>You must not use the service for any unlawful purpose.</li>
      </ul>
      <h2>No warranty</h2>
      <p>
        The service is provided “as is”, without warranties of any kind. Although we work hard to make every tool reliable, always keep a copy of your original files. We are not
        liable for any loss of data or damages arising from use of the service.
      </p>
      <h2>Changes</h2>
      <p>We may update these terms from time to time. Continued use of the service after changes means you accept the updated terms.</p>
    </Prose>
  );
}

export function Contact() {
  usePageMeta('Contact', `Get in touch with the ${SITE_NAME} team.`);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const subject = `${SITE_NAME} feedback${name.trim() ? ` from ${name.trim()}` : ''}`;
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  // Opens Gmail's compose window in the browser — works even without an email app installed.
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy our email address:', CONTACT_EMAIL);
    }
  };

  return (
    <Prose title="Contact us" intro="Found a bug, have a feature idea or a question? We’d love to hear from you.">
      <form
        className="card space-y-5 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          window.open(gmail, '_blank', 'noopener');
        }}
      >
        <Field label="Your name" htmlFor="c-name">
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Message" htmlFor="c-msg" hint="Your message opens ready to send — just press Send.">
          <textarea id="c-msg" required rows={5} className="input h-auto py-3" value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" icon={Send} disabled={!message.trim()}>
            Send with Gmail
          </Button>
          <a href={mailto} aria-disabled={!message.trim()} className={buttonClass('secondary', 'md', !message.trim() ? 'pointer-events-none opacity-60' : '')}>
            <Mail className="size-4" aria-hidden /> Use my email app
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span>Or email us directly:</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            {CONTACT_EMAIL}
          </a>
          <button type="button" onClick={copyEmail} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Copy email address">
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </form>
    </Prose>
  );
}

export function NotFound() {
  usePageMeta('Page not found', 'The page you were looking for does not exist.');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <FileQuestion className="size-12 text-slate-300" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you’re looking for doesn’t exist or has moved.</p>
      <ButtonLink to="/" className="mt-6">
        Back to home
      </ButtonLink>
    </div>
  );
}
