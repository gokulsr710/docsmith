import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLES: Record<ToastType, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: AlertCircle, cls: 'text-rose-600 dark:text-rose-400' },
  info: { icon: Info, cls: 'text-brand-600 dark:text-brand-400' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, type, title, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, m) => push('success', t, m),
      error: (t, m) => push('error', t, m),
      info: (t, m) => push('info', t, m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lift dark:border-white/10 dark:bg-slate-900"
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${cls}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.message && <p className="mt-0.5 break-words text-sm text-slate-500 dark:text-slate-400">{t.message}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
