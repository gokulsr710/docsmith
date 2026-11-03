import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { searchTools } from '../../lib/tools';

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();
  const results = searchTools(query);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search tools">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/10">
          <Search className="size-5 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && results[active]) {
                go(results[active].path);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search tools… e.g. merge, compress, png"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
            aria-label="Search tools"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `search-${results[active].id}` : undefined}
          />
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close search">
            <X className="size-4" />
          </button>
        </div>
        <ul ref={listRef} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-slate-500">No tools match “{query}”.</li>}
          {results.map((t, i) => {
            const Icon = t.icon;
            return (
              <li key={t.id} id={`search-${t.id}`} role="option" aria-selected={i === active} data-index={i}>
                <button
                  onClick={() => go(t.path)}
                  onMouseMove={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${i === active ? 'bg-slate-100 dark:bg-white/10' : ''}`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${t.tint}`}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.title}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t.description}</span>
                  </span>
                  {i === active && <CornerDownLeft className="hidden size-4 text-slate-400 sm:block" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
