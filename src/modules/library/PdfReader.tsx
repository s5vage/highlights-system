'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronLeft, Minus, Moon, Plus, Sun, TriangleAlert } from 'lucide-react';
import StateMessage from '@/components/StateMessage';
import { Book, HighlightColor, HlRect } from '@/lib/types';
import { loadPdfjs } from './pdf';
import { HighlightMenu, SelectionBar } from './HighlightTools';
import { useBookHighlights } from './useBookHighlights';

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

interface PageHl {
  id: string;
  color: HighlightColor;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SelectionState {
  x: number;
  y: number;
  below: boolean;
  text: string;
  rects: HlRect[];
}

const NO_ITEMS: PageHl[] = [];

// A selection comes back as one box per word or fragment; join them into one
// clean box per line so the highlight looks like a marker stroke.
function mergeLineRects(rs: DOMRect[]) {
  const items = rs
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
    .sort((a, b) => a.top - b.top || a.left - b.left);
  const out: typeof items = [];
  for (const r of items) {
    const last = out[out.length - 1];
    if (last) {
      const overlap = Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top);
      const minH = Math.min(last.bottom - last.top, r.bottom - r.top);
      if (overlap > minH * 0.5 && r.left <= last.right + 6) {
        last.left = Math.min(last.left, r.left);
        last.right = Math.max(last.right, r.right);
        last.top = Math.min(last.top, r.top);
        last.bottom = Math.max(last.bottom, r.bottom);
        continue;
      }
    }
    out.push({ ...r });
  }
  return out;
}

function PdfPage({
  pdf,
  pageNumber,
  scale,
  base,
  root,
  setEl,
  items,
  onPageClick,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  base: Size;
  root: HTMLElement | null;
  setEl: (n: number, el: HTMLDivElement | null) => void;
  items: PageHl[];
  onPageClick: (e: React.MouseEvent<HTMLDivElement>, items: PageHl[]) => void;
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
      onClick={(e) => onPageClick(e, items)}
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
      <div className="pdf-hl-layer" aria-hidden>
        {items.map((it, i) => (
          <div
            key={`${it.id}-${i}`}
            className="pdf-hl"
            data-color={it.color}
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, width: `${it.w * 100}%`, height: `${it.h * 100}%` }}
          />
        ))}
      </div>
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

  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const hl = useBookHighlights(book, notify);
  const [sel, setSel] = useState<SelectionState | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const pointerDown = useRef(false);

  const byPage = useMemo(() => {
    const m = new Map<number, PageHl[]>();
    hl.items.forEach((h) =>
      h.rects.forEach((r) => {
        const list = m.get(r.page) ?? [];
        list.push({ id: h.id, color: h.color, x: r.x, y: r.y, w: r.w, h: r.h });
        m.set(r.page, list);
      })
    );
    return m;
  }, [hl.items]);

  // Turn the current text selection into highlight boxes (as fractions of each page).
  const capture = useCallback((): SelectionState | null => {
    const scroller = scrollRef.current;
    const s = window.getSelection();
    if (!scroller || !s || s.isCollapsed || s.rangeCount === 0) return null;
    const range = s.getRangeAt(0);
    if (!scroller.contains(range.commonAncestorContainer)) return null;
    const text = s.toString().replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const rects: HlRect[] = [];
    pageEls.current.forEach((wrap, i) => {
      if (!wrap) return;
      const layer = wrap.querySelector('.textLayer');
      if (!layer || !range.intersectsNode(layer)) return;
      const part = document.createRange();
      part.selectNodeContents(layer);
      if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
      const box = wrap.getBoundingClientRect();
      const raw = Array.from(part.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
      mergeLineRects(raw).forEach((r) =>
        rects.push({
          page: i + 1,
          x: (r.left - box.left) / box.width,
          y: (r.top - box.top) / box.height,
          w: (r.right - r.left) / box.width,
          h: (r.bottom - r.top) / box.height,
        })
      );
    });
    if (rects.length === 0) return null;

    const bounds = range.getBoundingClientRect();
    const below = window.matchMedia('(pointer: coarse)').matches || bounds.top < 130;
    return { x: bounds.left + bounds.width / 2, y: below ? bounds.bottom : bounds.top, below, text, rects };
  }, []);

  // Show the highlight bar whenever text is selected (and you've let go of the mouse).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!pointerDown.current) setSel(capture());
      });
    };
    const down = () => {
      pointerDown.current = true;
      setSel(null);
    };
    const up = () => {
      pointerDown.current = false;
      update();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('scroll', update);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('selectionchange', update);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('scroll', update);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('selectionchange', update);
    };
  }, [capture, status]);

  function pickColor(color: HighlightColor) {
    if (!sel) return;
    hl.create({ color, text: sel.text, rects: sel.rects });
    window.getSelection()?.removeAllRanges();
    setSel(null);
  }

  function copyText(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => notify('Copied'))
      .catch(() => notify('Couldn’t copy'));
  }

  // Click a highlight that's already on the page to change it or remove it.
  const onPageClick = useCallback((e: React.MouseEvent<HTMLDivElement>, items: PageHl[]) => {
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    const box = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - box.left) / box.width;
    const fy = (e.clientY - box.top) / box.height;
    const hit = items.find((it) => fx >= it.x && fx <= it.x + it.w && fy >= it.y && fy <= it.y + it.h);
    setMenu(hit ? { id: hit.id, x: e.clientX, y: e.clientY } : null);
  }, []);

  const menuItem = menu ? hl.items.find((h) => h.id === menu.id) ?? null : null;

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
              <PdfPage
                key={i}
                pdf={pdf}
                pageNumber={i + 1}
                scale={scale}
                base={base}
                root={root}
                setEl={setEl}
                items={byPage.get(i + 1) ?? NO_ITEMS}
                onPageClick={onPageClick}
              />
            ))
          )}
        </div>
      )}

      {sel && <SelectionBar x={sel.x} y={sel.y} below={sel.below} onPick={pickColor} onCopy={() => copyText(sel.text)} />}
      {menu && menuItem && (
        <HighlightMenu
          x={menu.x}
          y={menu.y}
          color={menuItem.color}
          onColor={(c) => hl.recolor(menuItem.id, c)}
          onCopy={() => {
            copyText(menuItem.text);
            setMenu(null);
          }}
          onDelete={() => {
            hl.remove(menuItem.id);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {toast && (
        <div
          className="pop !min-w-0 !px-4 !py-2.5 text-[13px] font-medium"
          style={{ left: '50%', bottom: 28, top: 'auto', transform: 'translateX(-50%)' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}