import { useCallback, useRef, useState } from 'react';
import { useSession } from '../../context/session';
import { useToast } from '../../context/toast';
import { errorMessage, type OutputFile } from '../../lib/files';

export interface ToolOutput extends OutputFile {
  /** Size of the source file, used to show before/after comparisons. */
  originalSize?: number;
}

export interface ToolResult {
  outputs: ToolOutput[];
  /** Name of the ZIP created by "Download all". */
  zipName: string;
  title?: string;
  message?: string;
  /** Shows a before/after size comparison when set. */
  compare?: { before: number; after: number };
  note?: string;
}

export interface Progress {
  value: number;
  label: string;
}

export type Report = (value: number, label?: string) => void;

export function useToolRun(toolId: string) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const { addRecent } = useSession();
  const toast = useToast();
  const running = useRef(false);

  const start = useCallback(
    async (task: (report: Report) => Promise<ToolResult>) => {
      if (running.current) return;
      running.current = true;
      let lastLabel = 'Preparing…';
      setProgress({ value: 0, label: lastLabel });
      try {
        const res = await task((value, label) => {
          if (label) lastLabel = label;
          setProgress({ value, label: lastLabel });
        });
        if (!res.outputs.length) throw new Error('Nothing was produced. Please check your files and settings.');
        setProgress({ value: 1, label: 'Done' });
        setResult(res);
        addRecent(toolId, res.outputs);
        toast.success(res.title ?? 'Your files are ready', res.outputs.length > 1 ? `${res.outputs.length} files created` : res.outputs[0].name);
      } catch (e) {
        console.error(e);
        toast.error('Processing failed', errorMessage(e));
      } finally {
        running.current = false;
        setProgress(null);
      }
    },
    [addRecent, toast, toolId],
  );

  const clearResult = useCallback(() => setResult(null), []);
  return { progress, result, start, clearResult, busy: progress !== null };
}

export type ToolRun = ReturnType<typeof useToolRun>;
