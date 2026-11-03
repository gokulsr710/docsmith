import { useCallback, useEffect, useRef, useState } from 'react';
import { loadImage } from '../../lib/image';
import { uid } from '../../lib/files';
import { useToast } from '../../context/toast';

export interface ImageItem {
  id: string;
  file: File;
  /** Object URL for previews; revoked when the item is removed. */
  url: string;
  width: number;
  height: number;
  rotation: number;
}

/** Manages a list of uploaded images, validating that each one decodes. */
export function useImageItems() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(0);
  const toast = useToast();
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const add = useCallback(
    async (files: File[], replace = false) => {
      setLoading((n) => n + files.length);
      const loaded: ImageItem[] = [];
      const broken: string[] = [];
      await Promise.all(
        files.map(async (file, i) => {
          try {
            const img = await loadImage(file);
            const url = URL.createObjectURL(file);
            urls.current.add(url);
            loaded[i] = { id: uid(), file, url, width: img.naturalWidth, height: img.naturalHeight, rotation: 0 };
          } catch {
            broken.push(file.name);
          } finally {
            setLoading((n) => n - 1);
          }
        }),
      );
      if (broken.length)
        toast.error(broken.length === 1 ? `“${broken[0]}” couldn't be opened` : `${broken.length} images couldn't be opened`, 'The file may be corrupted or not a real image.');
      const ok = loaded.filter(Boolean);
      setItems((prev) => {
        if (replace) prev.forEach((p) => release(p.url));
        return replace ? ok : [...prev, ...ok];
      });
      return ok;
    },
    [toast],
  );

  function release(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) release(item.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const update = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      prev.forEach((p) => release(p.url));
      return [];
    });
  }, []);

  return { items, setItems, add, remove, update, clear, loading: loading > 0 };
}
