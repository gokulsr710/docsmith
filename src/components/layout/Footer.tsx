import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { TOOLS } from '../../lib/tools';
import { Logo } from './Logo';

export function Footer() {
  const pdf = TOOLS.filter((t) => t.categories[0] === 'pdf');
  const image = TOOLS.filter((t) => t.categories[0] === 'image');
  const linkCls = 'text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';

  return (
    <footer className="mt-24 border-t border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Free, fast PDF and image tools that run entirely in your browser. No sign-up, no uploads, no watermarks.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="size-4" aria-hidden /> Your files never leave your device
          </p>
        </div>
        <FooterCol title="PDF Tools">
          {pdf.map((t) => (
            <Link key={t.id} to={t.path} className={linkCls}>
              {t.title}
            </Link>
          ))}
        </FooterCol>
        <FooterCol title="Image Tools">
          {image.map((t) => (
            <Link key={t.id} to={t.path} className={linkCls}>
              {t.title}
            </Link>
          ))}
        </FooterCol>
        <FooterCol title="Company">
          <Link to="/about" className={linkCls}>About</Link>
          <Link to="/contact" className={linkCls}>Contact</Link>
          <Link to="/privacy" className={linkCls}>Privacy Policy</Link>
          <Link to="/terms" className={linkCls}>Terms and Conditions</Link>
        </FooterCol>
      </div>
      <div className="border-t border-slate-100 dark:border-white/5">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400 sm:px-6">© {new Date().getFullYear()} Docsmith. All processing happens locally in your browser.</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
