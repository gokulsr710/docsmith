import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  description?: string;
}

/** Accessible single-choice segmented control (radio group). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  hint,
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  columns?: number;
  hint?: ReactNode;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-white/5" style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = o.value === value;
          const Icon = o.icon;
          return (
            <label
              key={o.value}
              className={`relative flex min-h-10 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-center text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                active
                  ? 'bg-white text-slate-900 shadow-soft dark:bg-white/15 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className="size-4" aria-hidden />}
                {o.label}
              </span>
              {o.description && <span className="text-[11px] font-normal leading-tight opacity-75">{o.description}</span>}
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </fieldset>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: ReactNode;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-brand-600"
        style={{ background: `linear-gradient(to right, var(--color-brand-600) ${pct}%, rgb(148 163 184 / 0.3) ${pct}%)` }}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'brand' | 'amber' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  };
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

export function NumberInput({
  label,
  value,
  onChange,
  min = 1,
  max = 20000,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className="input pr-10 tabular-nums"
          value={Number.isFinite(value) && value > 0 ? value : ''}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            onChange(Number.isFinite(v) ? Math.min(max, v) : 0);
          }}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
