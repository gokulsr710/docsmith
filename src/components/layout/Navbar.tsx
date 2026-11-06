import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useTheme } from '../../context/theme';
import { SearchPalette } from './SearchPalette';
import { Logo } from './Logo';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/pdf-tools', label: 'PDF Tools' },
  { to: '/image-tools', label: 'Image Tools' },
  { to: '/about', label: 'About' },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
    }`;

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b transition-colors ${
          scrolled || menuOpen
            ? 'border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-ink/85'
            : 'border-transparent bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6" aria-label="Main">
          <Link to="/" className="mr-4 flex items-center gap-2 rounded-lg" aria-label="Docsmith home">
            <Logo />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-600 lg:flex dark:border-white/10 dark:bg-white/5 dark:hover:text-slate-200"
              aria-label="Search tools"
            >
              <Search className="size-4" aria-hidden />
              <span className="pr-6">Search tools…</span>
              <kbd className="rounded border border-slate-200 px-1.5 text-[10px] font-semibold dark:border-white/15">Ctrl K</kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Search tools"
            >
              <Search className="size-5" />
            </button>
            <button
              onClick={toggle}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-white/10"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div id="mobile-menu" className="animate-fade-up border-t border-slate-100 px-4 pt-2 pb-4 md:hidden dark:border-white/10">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex h-12 items-center rounded-xl px-3 text-base font-medium ${isActive ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
