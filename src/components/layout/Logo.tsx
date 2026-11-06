export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand-600" />
        <path d="M10 8h8l5 5v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" fill="#fff" />
        <path d="M18 8v5h5" fill="#00d4ff" />
        <path d="M11.5 19.5l3 3 6-6" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-600" />
      </svg>
      <span className="text-[17px] font-bold tracking-tight">Docsmith</span>
    </span>
  );
}
