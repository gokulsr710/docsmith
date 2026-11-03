import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openPdf, renderThumbnail } from '../../lib/pdf';
import { errorMessage } from '../../lib/files';
import { useToast } from '../../context/toast';

export interface LoadedPdf {
  file: File;
  bytes: ArrayBuffer;
  doc: PDFDocumentProxy;
  pageCount: number;
}

/**
 * Loads a single PDF with PDF.js and progressively renders page thumbnails.
 * Thumbnails are object URLs that are revoked on reset/unmount.
 */
export function usePdfDoc({ thumbnails = true, thumbWidth = 180 } = {}) {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [thumbs, setThumbs] = useState<(string | undefined)[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const generation = useRef(0);
  const urls = useRef<string[]>([]);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  const release = useCallback(() => {
    generation.current++;
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    docRef.current?.destroy();
    docRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  const load = useCallback(
    async (file: File) => {
      release();
      const gen = generation.current;
      setPdf(null);
      setThumbs([]);
      setLoading(true);
      try {
        const bytes = await file.arrayBuffer();
        const doc = await openPdf(bytes);
        if (gen !== generation.current) return void doc.destroy();
        docRef.current = doc;
        setPdf({ file, bytes, doc, pageCount: doc.numPages });
        setLoading(false);
        if (!thumbnails) return;
        setThumbs(new Array(doc.numPages).fill(undefined));
        for (let i = 1; i <= doc.numPages; i++) {
          if (gen !== generation.current) return;
          try {
            const url = await renderThumbnail(doc, i, thumbWidth);
            if (gen !== generation.current) return URL.revokeObjectURL(url);
            urls.current.push(url);
            setThumbs((t) => {
              const next = [...t];
              next[i - 1] = url;
              return next;
            });
          } catch {
            /* a page that fails to render keeps its placeholder */
          }
        }
      } catch (e) {
        if (gen === generation.current) {
          toast.error(`Couldn't open “${file.name}”`, errorMessage(e));
          setLoading(false);
        }
      }
    },
    [release, thumbnails, thumbWidth, toast],
  );

  const reset = useCallback(() => {
    release();
    setPdf(null);
    setThumbs([]);
    setLoading(false);
  }, [release]);

  return { pdf, thumbs, loading, load, reset };
}
