import type { CSSProperties, ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { ToolLayout, useFileIntake } from './ToolLayout';
import { useToolRun, type ToolOutput, type ToolResult } from './useToolRun';
import { useImageItems, type ImageItem } from './useImageItems';
import { Dropzone } from '../ui/Dropzone';
import { acceptAttr, formatBytes, nextFrame, pluralize, type AcceptKind } from '../../lib/files';
import { loadImage } from '../../lib/image';
import type { Tool } from '../../lib/tools';

interface ImageBatchToolProps {
  tool: Tool;
  accept: AcceptKind[];
  actionLabel: string;
  actionIcon: LucideIcon;
  settings: ReactNode;
  /** Converts one image. Throwing aborts with a readable error. */
  process: (item: ImageItem, img: HTMLImageElement) => Promise<Omit<ToolOutput, 'originalSize'>>;
  /** Show before/after size comparison on the result screen. */
  compare?: boolean;
  zipName: string;
  resultTitle?: (outputs: ToolOutput[]) => string;
  /** Optional per-image preview style (e.g. live rotation) and caption. */
  previewStyle?: (item: ImageItem) => CSSProperties;
  caption?: (item: ImageItem) => ReactNode;
  disabled?: boolean;
  hint?: string;
}

export function ImageBatchTool({
  tool,
  accept,
  actionLabel,
  actionIcon,
  settings,
  process,
  compare,
  zipName,
  resultTitle,
  previewStyle,
  caption,
  disabled,
  hint,
}: ImageBatchToolProps) {
  const images = useImageItems();
  const run = useToolRun(tool.id);
  const intake = useFileIntake(accept, (f) => images.add(f));
  const { items } = images;
  const total = items.reduce((s, i) => s + i.file.size, 0);

  const start = () =>
    run.start(async (report) => {
      const outputs: ToolOutput[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        report(i / items.length, items.length > 1 ? `Processing ${i + 1} of ${items.length}: ${item.file.name}` : `Processing ${item.file.name}…`);
        await nextFrame();
        const img = await loadImage(item.file);
        outputs.push({ ...(await process(item, img)), originalSize: item.file.size });
      }
      const result: ToolResult = { outputs, zipName, title: resultTitle?.(outputs) };
      if (compare) {
        const after = outputs.reduce((s, o) => s + o.blob.size, 0);
        result.compare = { before: total, after };
      }
      return result;
    });

  return (
    <ToolLayout
      tool={tool}
      accept={accept}
      onFiles={(f) => images.add(f)}
      hasFiles={items.length > 0 || images.loading}
      run={run}
      onReset={images.clear}
      heading={
        <span>
          {pluralize(items.length, 'image')} <span className="font-normal text-slate-400">· {formatBytes(total)}</span>
        </span>
      }
      settings={settings}
      action={{ label: actionLabel, icon: actionIcon, onClick: start, disabled: !items.length || images.loading || disabled, hint }}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="group card flex flex-col p-2 transition hover:shadow-lift sm:p-3">
            <div className="checker relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-2 dark:bg-white/5">
              <img src={item.url} alt={item.file.name} className="max-h-full max-w-full object-contain transition-transform duration-200" style={previewStyle?.(item)} />
              <button
                onClick={() => images.remove(item.id)}
                className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:bg-slate-800 dark:text-slate-300"
                aria-label={`Remove ${item.file.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-2 px-1">
              <p className="truncate text-xs font-medium sm:text-sm" title={item.file.name}>
                {item.file.name}
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {caption ? caption(item) : `${item.width}×${item.height} · ${formatBytes(item.file.size)}`}
              </p>
            </div>
          </div>
        ))}
        <Dropzone compact accept={acceptAttr(accept)} onFiles={intake} />
      </div>
    </ToolLayout>
  );
}
