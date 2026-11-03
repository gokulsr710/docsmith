import { useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { PageThumb, PdfFileHeader, thumbGridClass } from '../components/tool/PageThumb';
import { Field, NumberInput, Segmented, Toggle } from '../components/ui/controls';
import { baseName, nextFrame, pluralize, type OutputFile } from '../lib/files';
import { loadPdfLib, parseRanges, pdfBlob } from '../lib/pdf';
import { getTool } from '../lib/tools';

type Mode = 'all' | 'ranges' | 'fixed';

function rangeLabel(group: number[]) {
  return group.length === 1 ? `${group[0] + 1}` : `${group[0] + 1}-${group[group.length - 1] + 1}`;
}

export default function SplitPdf() {
  const tool = getTool('split-pdf');
  const { pdf, thumbs, loading, load, reset } = usePdfDoc();
  const run = useToolRun(tool.id);
  const [mode, setMode] = useState<Mode>('ranges');
  const [ranges, setRanges] = useState('');
  const [mergeRanges, setMergeRanges] = useState(false);
  const [every, setEvery] = useState(2);
  const count = pdf?.pageCount ?? 0;

  const groups = useMemo<number[][] | string>(() => {
    if (!count) return [];
    if (mode === 'all') return Array.from({ length: count }, (_, i) => [i]);
    if (mode === 'fixed') {
      if (!every || every < 1) return 'Enter how many pages each file should have.';
      return Array.from({ length: Math.ceil(count / every) }, (_, g) => Array.from({ length: Math.min(every, count - g * every) }, (_, i) => g * every + i));
    }
    if (!ranges.trim()) return [];
    const parsed = parseRanges(ranges, count);
    return typeof parsed === 'string' || !mergeRanges ? parsed : [parsed.flat()];
  }, [count, mode, ranges, mergeRanges, every]);

  const error = typeof groups === 'string' ? groups : null;
  const valid = Array.isArray(groups) ? groups : [];
  const groupOf = useMemo(() => {
    const m = new Map<number, number>();
    valid.forEach((g, gi) => g.forEach((p) => m.set(p, gi)));
    return m;
  }, [valid]);

  const split = () => {
    if (!pdf) return;
    run.start(async (report) => {
      const { PDFDocument } = await import('pdf-lib');
      const src = await loadPdfLib(pdf.bytes);
      const base = baseName(pdf.file.name);
      const outputs: OutputFile[] = [];
      for (let i = 0; i < valid.length; i++) {
        report(i / valid.length, `Creating file ${i + 1} of ${valid.length}…`);
        await nextFrame();
        const out = await PDFDocument.create();
        (await out.copyPages(src, valid[i])).forEach((p) => out.addPage(p));
        const label = mergeRanges && mode === 'ranges' ? 'extracted' : `pages-${rangeLabel(valid[i])}`;
        outputs.push({ name: `${base}-${mode === 'all' ? `page-${valid[i][0] + 1}` : label}.pdf`, blob: pdfBlob(await out.save()) });
      }
      return { outputs, zipName: `${base}-split.zip`, title: outputs.length > 1 ? 'Your PDF has been split!' : 'Your PDF is ready!' };
    });
  };

  const togglePage = (i: number) => {
    // Clicking a page in range mode appends it to the ranges input.
    if (mode !== 'ranges') return;
    const n = String(i + 1);
    const parts = ranges.split(',').map((s) => s.trim()).filter(Boolean);
    setRanges((parts.includes(n) ? parts.filter((p) => p !== n) : [...parts, n]).join(', '));
  };

  return (
    <ToolLayout
      tool={tool}
      accept={['pdf']}
      multiple={false}
      onFiles={(f) => load(f[0])}
      hasFiles={!!pdf || loading}
      run={run}
      onReset={() => {
        reset();
        setRanges('');
      }}
      heading={pdf ? <PdfFileHeader file={pdf.file} pageCount={pdf.pageCount} /> : 'Opening PDF…'}
      action={{
        label: 'Split PDF',
        icon: Scissors,
        onClick: split,
        disabled: !pdf || !!error || !valid.length,
        hint: error ?? (valid.length ? `Creates ${pluralize(valid.length, 'PDF file')}` : 'Choose which pages to split'),
      }}
      settings={
        <>
          <Segmented
            label="Split mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ranges', label: 'Ranges' },
              { value: 'all', label: 'Every page' },
              { value: 'fixed', label: 'Fixed' },
            ]}
          />
          {mode === 'ranges' && (
            <>
              <Field label="Page ranges" htmlFor="ranges" hint={error ? <span className="text-rose-600 dark:text-rose-400">{error}</span> : 'Separate with commas, e.g. 1-3, 5, 8-10. Or tap pages to add them.'}>
                <input id="ranges" className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder={`e.g. 1-${Math.min(3, count)}, ${count}`} inputMode="text" />
              </Field>
              <Toggle label="Merge all ranges into one PDF" description="Extract the selected pages into a single file." checked={mergeRanges} onChange={setMergeRanges} />
            </>
          )}
          {mode === 'fixed' && <NumberInput label="Pages per file" value={every} onChange={setEvery} min={1} max={count || 1} />}
          {mode === 'all' && <p className="text-sm text-slate-500 dark:text-slate-400">Each of the {count} pages becomes its own PDF, downloaded together as a ZIP.</p>}
        </>
      }
    >
      <div className={thumbGridClass}>
        {Array.from({ length: count }, (_, i) => {
          const g = groupOf.get(i);
          return (
            <PageThumb
              key={i}
              src={thumbs[i]}
              label={i + 1}
              state={g !== undefined && mode === 'ranges' ? 'selected' : 'normal'}
              onClick={mode === 'ranges' ? () => togglePage(i) : undefined}
              ariaLabel={`Page ${i + 1}`}
              footer={g !== undefined && valid.length > 1 && <span className="rounded bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">File {g + 1}</span>}
            />
          );
        })}
      </div>
    </ToolLayout>
  );
}
