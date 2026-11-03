import { Link } from 'react-router-dom';
import { Instagram, ShieldCheck } from 'lucide-react';
import { TOOLS } from '../../lib/tools';
import { Logo } from './Logo';
import { CREATOR_INSTAGRAM } from '../../lib/seo';

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
        <div className="mx-auto flex max-w-7xl flex-col-reverse items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Docsmith. All processing happens locally in your browser.</p>
          <a
            href={CREATOR_INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pr-3.5 pl-1.5 text-sm text-slate-600 shadow-soft transition hover:border-pink-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-pink-500/40 dark:hover:text-white"
            aria-label="Made by @_gr_tech_circuits on Instagram (opens in a new tab)"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white transition-transform group-hover:scale-110">
              <Instagram className="size-4" aria-hidden />
            </span>
            <span>
              Made by <span className="font-semibold">@_gr_tech_circuits</span>
            </span>
          </a>
        </div>
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
