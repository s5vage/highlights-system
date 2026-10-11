import type * as PdfJs from 'pdfjs-dist';

// pdf.js touches browser-only globals when it loads, so it is imported on
// demand (never during server rendering) and only once.
let pdfjsPromise: Promise<typeof PdfJs> | null = null;

export function loadPdfjs(): Promise<typeof PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return lib;
    });
  }
  return pdfjsPromise;
}

export interface PdfMeta {
  pageCount: number;
  author: string | null;
  cover: Blob | null;
}

// Reads the page count and author, and renders page 1 as a cover image.
export async function readPdfMeta(file: File): Promise<PdfMeta> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  let author: string | null = null;
  try {
    const meta = await pdf.getMetadata();
    const raw = (meta.info as Record<string, unknown>)?.Author;
    const clean = typeof raw === 'string' ? raw.trim() : '';
    // Many PDFs carry placeholder authors from the tool that made them.
    if (clean && !/^(anonymous|unknown|admin|administrator|user|author|owner|microsoft.*)$/i.test(clean)) {
      author = clean.slice(0, 120);
    }
  } catch {
    author = null;
  }

  let cover: Blob | null = null;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 360 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
      cover = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    }
  } catch {
    cover = null;
  }

  const pageCount = pdf.numPages;
  await pdf.destroy();
  return { pageCount, author, cover };
}