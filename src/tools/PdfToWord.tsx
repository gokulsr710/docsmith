import { useState } from 'react';
import { FileType } from 'lucide-react';
import { ToolLayout } from '../components/tool/ToolLayout';
import { useToolRun } from '../components/tool/useToolRun';
import { usePdfDoc } from '../components/tool/usePdfDoc';
import { PageThumb, PdfFileHeader, thumbGridClass } from '../components/tool/PageThumb';
import { Segmented } from '../components/ui/controls';
import { baseName, formatBytes, pluralize } from '../lib/files';
import { getTool } from '../lib/tools';
import { pdfToDocx } from '../lib/word';

type Mode = 'editable' | 'layout';

export default function PdfToWord() {
  const tool = getTool('pdf-to-word');
  const { pdf, thumbs, loading, load, reset } = usePdfDoc();
  const run = useToolRun(tool.id);
  const [mode, setMode] = useState<Mode>('editable');

  const convert = () => {
    if (!pdf) return;
    run.start(async (report) => {
      const res = await pdfToDocx(pdf.doc, mode, report);
      const name = `${baseName(pdf.file.name)}.docx`;
      let note: string | undefined;
      if (mode === 'editable' && res.totalChars === 0)
        note = 'This PDF has no selectable text (it looks scanned), so pages were added as images. Text recognition (OCR) isn’t available yet.';
      else if (res.imagePages) note = `${pluralize(res.imagePages, 'page')} had no selectable text (scanned) and ${res.imagePages === 1 ? 'was' : 'were'} added as ${res.imagePages === 1 ? 'an image' : 'images'}.`;
      else if (mode === 'layout') note = 'Pages were added as images, so they look identical but the text can’t be edited. Choose “Editable text” to edit.';
      return {
        outputs: [{ name, blob: res.blob }],
        zipName: `${baseName(pdf.file.name)}-word.zip`,
        title: 'Your Word document is ready!',
        message: `${name} · ${pluralize(pdf.pageCount, 'page')} · ${formatBytes(res.blob.size)}`,
        note,
      };
    });
  };

  return (
    <ToolLayout
      tool={tool}
      accept={['pdf']}
      multiple={false}
      onFiles={(f) => load(f[0])}
      hasFiles={!!pdf || loading}
      run={run}
      onReset={reset}
      heading={pdf ? <PdfFileHeader file={pdf.file} pageCount={pdf.pageCount} /> : 'Opening PDF…'}
      action={{ label: 'Convert to Word', icon: FileType, onClick: convert, disabled: !pdf }}
      settings={
        <Segmented
          label="Conversion mode"
          value={mode}
          onChange={setMode}
          columns={1}
          options={[
            { value: 'editable', label: 'Editable text', description: 'Rebuilds paragraphs, headings and images you can edit' },
            { value: 'layout', label: 'Exact layout', description: 'Looks identical, pages become images (not editable)' },
          ]}
          hint="Editable mode works best for text documents like letters, reports and resumes. Complex layouts (columns, forms) may need touch-ups."
        />
      }
    >
      <div className={thumbGridClass}>
        {Array.from({ length: pdf?.pageCount ?? 0 }, (_, i) => (
          <PageThumb key={i} src={thumbs[i]} label={i + 1} />
        ))}
      </div>
    </ToolLayout>
  );
}
