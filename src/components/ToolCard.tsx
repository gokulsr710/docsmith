import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Tool } from '../lib/tools';

export function ToolCard({ tool, onClick }: { tool: Tool; onClick?: () => void }) {
  const Icon = tool.icon;
  return (
    <Link
      to={tool.path}
      onClick={onClick}
      className="group card relative flex h-full flex-col p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift sm:p-5 dark:hover:border-white/20"
    >
      <span className={`flex size-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 sm:size-12 ${tool.tint}`}>
        <Icon className="size-5 sm:size-6" aria-hidden />
      </span>
      <h3 className="mt-3 text-[15px] font-semibold sm:mt-4">{tool.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">{tool.description}</p>
      <ArrowUpRight
        className="absolute top-4 right-4 size-4 text-slate-300 opacity-0 transition-all duration-200 group-hover:opacity-100 sm:top-5 sm:right-5 dark:text-slate-500"
        aria-hidden
      />
    </Link>
  );
}

export function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} />
      ))}
    </div>
  );
}
