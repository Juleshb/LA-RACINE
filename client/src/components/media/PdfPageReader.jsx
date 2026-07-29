import { useEffect, useId, useRef, useState } from 'react';
import { pdfjs } from '../../lib/pdfjs';
import AppIcon, { IconLabel } from '../icons/AppIcon';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function isRenderCancelled(err) {
  return err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled');
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function disposePdfDocument(doc, loadingTask) {
  void (async () => {
    try {
      if (doc && typeof doc.cleanup === 'function') {
        await doc.cleanup();
        return;
      }
      if (loadingTask && typeof loadingTask.destroy === 'function') {
        await loadingTask.destroy();
        return;
      }
      if (doc?.loadingTask && typeof doc.loadingTask.destroy === 'function') {
        await doc.loadingTask.destroy();
      }
    } catch {
      /* ignore cleanup errors */
    }
  })();
}

export default function PdfPageReader({ url, compact = false }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [resizeKey, setResizeKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageOrientation, setPageOrientation] = useState('portrait');

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pagePickId = useId();

  useEffect(() => {
    let cancelled = false;
    let doc = null;
    let loadingTask = null;

    setLoading(true);
    setError('');
    setPdfDoc(null);
    setPageNum(1);
    setTotalPages(0);
    setZoom(1);

    (async () => {
      try {
        const buffer = await fetch(url).then((res) => {
          if (!res.ok) throw new Error('Could not load this PDF');
          return res.arrayBuffer();
        });
        if (cancelled) return;

        loadingTask = pdfjs.getDocument({ data: buffer });
        doc = await loadingTask.promise;
        if (cancelled) {
          disposePdfDocument(doc, loadingTask);
          return;
        }
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setPageNum(1);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not open this PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      disposePdfDocument(doc, loadingTask);
    };
  }, [url]);

  useEffect(() => {
    if (!stageRef.current || !pdfDoc) return undefined;

    let timeoutId;
    let lastWidth = stageRef.current.clientWidth;
    let lastHeight = stageRef.current.clientHeight;

    const observer = new ResizeObserver(() => {
      const width = stageRef.current?.clientWidth || 0;
      const height = stageRef.current?.clientHeight || 0;
      if (Math.abs(width - lastWidth) < 4 && Math.abs(height - lastHeight) < 4) return;
      lastWidth = width;
      lastHeight = height;
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setResizeKey((k) => k + 1), 120);
    });

    observer.observe(stageRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || loading) return undefined;

    let cancelled = false;

    (async () => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return;

      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;

      setRendering(true);
      try {
        const pdfPage = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const natural = pdfPage.getViewport({ scale: 1 });
        setPageOrientation(natural.width >= natural.height ? 'landscape' : 'portrait');

        const padding = 16;
        const maxWidth = Math.max(stage.clientWidth - padding, 200);
        const maxHeight = Math.max(stage.clientHeight - padding, 200);
        const fitScale = Math.min(maxWidth / natural.width, maxHeight / natural.height);
        const scale = fitScale * zoom;

        const viewport = pdfPage.getViewport({ scale });
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const task = pdfPage.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;

        if (cancelled) return;
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      } catch (err) {
        if (cancelled || isRenderCancelled(err)) return;
        setError(err.message || 'Could not show this page');
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [pdfDoc, pageNum, compact, loading, resizeKey, zoom]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'SELECT' || e.target?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setPageNum((p) => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setPageNum((p) => Math.min(totalPages, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalPages]);

  const goPrev = () => setPageNum((p) => Math.max(1, p - 1));
  const goNext = () => setPageNum((p) => Math.min(totalPages, p + 1));
  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_STEP));
  const resetZoom = () => setZoom(1);

  const handlePagePick = (e) => {
    const next = Number(e.target.value);
    if (next >= 1 && next <= totalPages) setPageNum(next);
  };

  if (loading) {
    return <div className="pdf-page-reader-loading">Opening book…</div>;
  }

  if (error && !pdfDoc) {
    return <div className="pdf-page-reader-error">{error}</div>;
  }

  const atStart = pageNum <= 1;
  const atEnd = pageNum >= totalPages;
  const zoomPct = Math.round(zoom * 100);

  return (
    <div className={`pdf-page-reader ${compact ? 'pdf-page-reader-compact' : ''}`}>
      <div className="pdf-page-reader-toolbar">
        <div className="pdf-page-reader-zoom" aria-label="Zoom controls">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM || rendering}
            className="pdf-page-reader-tool-btn"
            aria-label="Zoom out"
          >
            <AppIcon name="zoomOut" className="w-5 h-5" />
          </button>
          <span className="pdf-page-reader-zoom-label">{zoomPct}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM || rendering}
            className="pdf-page-reader-tool-btn"
            aria-label="Zoom in"
          >
            <AppIcon name="zoomIn" className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={zoom === 1 || rendering}
            className="pdf-page-reader-tool-btn pdf-page-reader-tool-btn-text"
            aria-label="Fit page to screen"
          >
            <AppIcon name="fitPage" className="w-5 h-5" />
            <span>Fit page</span>
          </button>
        </div>

        <div className="pdf-page-reader-goto">
          <label htmlFor={pagePickId} className="pdf-page-reader-goto-label">
            Go to page
          </label>
          <select
            id={pagePickId}
            value={pageNum}
            onChange={handlePagePick}
            disabled={rendering}
            className="pdf-page-reader-goto-select"
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Page {i + 1}
              </option>
            ))}
          </select>
          <span className="pdf-page-reader-goto-total">of {totalPages}</span>
        </div>
      </div>

      <div
        className={`pdf-page-reader-stage pdf-page-reader-stage-${pageOrientation}`}
        ref={stageRef}
      >
        <div className="pdf-page-reader-canvas-wrap">
          <canvas ref={canvasRef} className="pdf-page-reader-canvas" />
        </div>
        {rendering && (
          <div className="pdf-page-reader-rendering" aria-hidden>Loading page…</div>
        )}
      </div>

      {error && (
        <p className="pdf-page-reader-error text-sm py-2">{error}</p>
      )}

      <div className="pdf-page-reader-nav" aria-label="Page navigation">
        <button
          type="button"
          onClick={goPrev}
          disabled={atStart || rendering}
          className="pdf-page-reader-btn pdf-page-reader-btn-prev"
          aria-label="Previous page"
        >
          <IconLabel icon="arrowLeft">Previous</IconLabel>
        </button>

        <p className="pdf-page-reader-count" aria-live="polite">
          Page <strong>{pageNum}</strong> of <strong>{totalPages}</strong>
        </p>

        <button
          type="button"
          onClick={goNext}
          disabled={atEnd || rendering}
          className="pdf-page-reader-btn pdf-page-reader-btn-next"
          aria-label="Next page"
        >
          <IconLabel icon="arrowRight">Next page</IconLabel>
        </button>
      </div>

      {!compact && (
        <p className="pdf-page-reader-hint">
          <AppIcon name="book" className="w-4 h-4 inline-block align-text-bottom" />
          {' '}
          Portrait and landscape pages fit naturally. Zoom in or pick any page to read.
        </p>
      )}
    </div>
  );
}
