'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronLeft, Minus, Moon, Plus, Sun, TriangleAlert } from 'lucide-react';
import StateMessage from '@/components/StateMessage';
import { Book } from '@/lib/types';
import { loadPdfjs } from './pdf';

interface Props {
  book: Book;
  getUrl: () => Promise<string>;
  onClose: () => void;
  onProgress: (page: number) => void;
}

interface Size {
  w: number;
  h: number;
}

const NIGHT_KEY = 'lib_night';

function PdfPage({
  pdf,
  pageNumber,
  scale,
  base,
  root,
  setEl,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  base: Size;
  root: HTMLElement | null;
  setEl: (n: number, el: HTMLDivElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [dims, setDims] = useState<Size | null>(null);

  // Only pages close to the screen are drawn. Far-away pages are blank boxes.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: '150% 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near) return;
    const canvas = canvasRef.current;
    const textDiv = textRef.current;
    if (!canvas || !textDiv) return;

    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      const [pdfjs, page] = await Promise.all([loadPdfjs(), pdf.getPage(pageNumber)]);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const natural = { w: viewport.width / scale, h: viewport.height / scale };
      if (Math.abs(natural.w - base.w) > 0.5 || Math.abs(natural.h - base.h) > 0.5) setDims(natural);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      task = page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        background: '#ffffff',
      });
      await task.promise;
      if (cancelled) return;

      textDiv.replaceChildren();
      const layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textDiv,
        viewport,
      });
      await layer.render();
    })().catch((err) => {
      if (err?.name !== 'RenderingCancelledException') console.error(err);
    });

    return () => {
      cancelled = true;
      task?.cancel();
      canvas.width = 0;
      canvas.height = 0;
      textDiv.replaceChildren();
    };
  }, [near, scale, pdf, pageNumber, base.w, base.h]);

  const w = (dims?.w ?? base.w) * scale;
  const h = (dims?.h ?? base.h) * scale;

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        setEl(pageNumber, el);
      }}
      className="pdf-page"
      data-page={pageNumber}
      style={
        {
          width: w,
          height: h,
          '--scale-factor': scale,
          '--total-scale-factor': scale,
          '--user-unit': 1,
        } as React.CSSProperties
      }
    >
      <canvas ref={canvasRef} />
      <div ref={textRef} className="textLayer" />
    </div>
  );
}

export default function PdfReader({ book, getUrl, onClose, onProgress }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [base, setBase] = useState<Size>({ w: 612, h: 792 });
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [night, setNight] = useState(false);
  const [current, setCurrent] = useState(Math.max(1, book.last_page));
  const [pageInput, setPageInput] = useState<string | null>(null);

  const restored = useRef(false);
  const keepRatio = useRef<number | null>(null);
  const savedPage = useRef(book.last_page);
  const currentRef = useRef(current);
  currentRef.current = current;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    setNight(localStorage.getItem(NIGHT_KEY) === '1');
  }, []);

  // Open the document.
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    setStatus('loading');
    (async () => {
      try {
        const [pdfjs, url] = await Promise.all([loadPdfjs(), getUrl()]);
        doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setBase({ w: vp.width, h: vp.height });
        setPdf(doc);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setErrorMsg(
          name === 'PasswordException'
            ? 'This PDF is password-protected, so it can’t be opened here.'
            : e instanceof Error && e.message
            ? e.message
            : 'The book couldn’t be opened.'
        );
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [getUrl, attempt]);

  // Measure the reading area.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setRoot(el);
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  const pad = width < 640 ? 12 : 28;
  const fit = width > 0 ? Math.min(width - pad * 2, 940) / base.w : 1;
  const scale = Math.max(0.2, fit * zoom);

  // Come back to where you left off.
  useLayoutEffect(() => {
    if (status !== 'ready' || restored.current || width === 0) return;
    restored.current = true;
    const el = scrollRef.current;
    const target = pageEls.current[Math.max(1, book.last_page) - 1];
    if (el && target) el.scrollTop = target.offsetTop - 14;
  }, [status, width, book.last_page]);

  // Keep your place when zooming.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && keepRatio.current !== null) {
      el.scrollTop = keepRatio.current * el.scrollHeight;
      keepRatio.current = null;
    }
  }, [scale]);

  function changeZoom(next: number) {
    const el = scrollRef.current;
    if (el) keepRatio.current = el.scrollTop / Math.max(1, el.scrollHeight);
    setZoom(Math.min(3, Math.max(0.5, Math.round(next * 100) / 100)));
  }

  // Work out which page is on screen.
  const frame = useRef(0);
  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const probe = el.scrollTop + el.clientHeight * 0.3;
      const pages = pageEls.current;
      let lo = 0;
      let hi = pages.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if ((pages[mid]?.offsetTop ?? 0) <= probe) lo = mid;
        else hi = mid - 1;
      }
      setCurrent(lo + 1);
    });
  }, []);

  // Save your place a moment after you stop moving, and when you leave.
  useEffect(() => {
    if (status !== 'ready' || current === savedPage.current) return;
    const t = setTimeout(() => {
      savedPage.current = current;
      onProgressRef.current(current);
    }, 1200);
    return () => clearTimeout(t);
  }, [current, status]);

  useEffect(
    () => () => {
      if (currentRef.current !== savedPage.current) onProgressRef.current(currentRef.current);
    },
    []
  );

  function jumpTo(n: number) {
    const total = pdf?.numPages ?? 1;
    const page = Math.min(total, Math.max(1, n));
    const el = scrollRef.current;
    const target = pageEls.current[page - 1];
    if (el && target) el.scrollTo({ top: target.offsetTop - 14 });
    setCurrent(page);
  }

  function toggleNight() {
    setNight((n) => {
      localStorage.setItem(NIGHT_KEY, n ? '0' : '1');
      return !n;
    });
  }

  const setEl = useCallback((n: number, el: HTMLDivElement | null) => {
    pageEls.current[n - 1] = el;
  }, []);

  const total = pdf?.numPages ?? book.page_count;

  return (
    <div className={`flex h-full flex-col ${night ? 'pdf-night' : ''}`} style={{ background: 'var(--bg)' }}>
      <div className="hl-bar flex h-[52px] shrink-0 items-center gap-1.5 px-2.5">
        <button
          type="button"
          onClick={onClose}
          className="tool !inline-flex !w-auto items-center gap-0.5 pl-1.5 pr-2.5 text-[14px] font-medium"
          aria-label="Back to library"
        >
          <ChevronLeft size={20} strokeWidth={2} />
          Library
        </button>

        <div className="min-w-0 flex-1 truncate px-1 text-center text-[13.5px] font-semibold tracking-[-0.008em]">
          {book.title}
        </div>

        <div className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
          <input
            value={pageInput ?? String(current)}
            onFocus={(e) => {
              setPageInput(String(current));
              e.currentTarget.select();
            }}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setPageInput(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = parseInt(pageInput ?? '', 10);
                if (!Number.isNaN(n)) jumpTo(n);
                setPageInput(null);
                e.currentTarget.blur();
              }
            }}
            inputMode="numeric"
            aria-label="Current page"
            className="tnum h-8 w-12 rounded-lg bg-[var(--fill)] text-center font-medium outline-none focus:bg-[var(--surface)]"
            style={{ color: 'var(--text)' }}
          />
          <span className="tnum pr-1">of {total}</span>
        </div>

        <div className="ml-1 flex items-center">
          <button type="button" className="tool" aria-label="Zoom out" title="Zoom out" onClick={() => changeZoom(zoom - 0.15)}>
            <Minus size={17} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="tool tnum !w-auto px-1.5 text-[12px] font-medium max-sm:hidden"
            title="Fit to width"
            onClick={() => changeZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="tool" aria-label="Zoom in" title="Zoom in" onClick={() => changeZoom(zoom + 0.15)}>
            <Plus size={17} strokeWidth={2} />
          </button>
        </div>
        <button
          type="button"
          className="tool"
          aria-label={night ? 'Use day reading mode' : 'Use night reading mode'}
          title={night ? 'Day mode' : 'Night mode'}
          onClick={toggleNight}
        >
          {night ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
        </button>
      </div>

      {status === 'error' ? (
        <StateMessage
          icon={<TriangleAlert size={22} strokeWidth={1.8} />}
          title="Couldn’t open this book"
          body={errorMsg}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          }
        />
      ) : (
        <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto" style={{ padding: `${pad}px ${pad}px 120px` }}>
          {status === 'loading' || !pdf ? (
            <div className="mx-auto" style={{ width: Math.min(Math.max(width - pad * 2, 200), 940) }}>
              <div className="skeleton" style={{ height: 'min(70vh, 640px)', borderRadius: 4 }} aria-busy="true" />
            </div>
          ) : (
            Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i} pdf={pdf} pageNumber={i + 1} scale={scale} base={base} root={root} setEl={setEl} />
            ))
          )}
        </div>
      )}
    </div>
  );
}