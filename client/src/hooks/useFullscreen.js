import { useCallback, useEffect, useRef, useState } from 'react';

function getFullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || null;
}

async function requestElementFullscreen(el) {
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
  throw new Error('Fullscreen not supported');
}

async function exitDocumentFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
}

export default function useFullscreen() {
  const ref = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const active = getFullscreenElement() === ref.current;
      setIsFullscreen(active);
      if (!active && !fallback) setFallback(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [fallback]);

  useEffect(() => {
    if (!fallback) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setFallback(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fallback]);

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    try {
      await requestElementFullscreen(el);
    } catch {
      setFallback(true);
    }
  }, []);

  const exit = useCallback(async () => {
    if (fallback) {
      setFallback(false);
      return;
    }
    try {
      await exitDocumentFullscreen();
    } catch {
      setFallback(false);
    }
  }, [fallback]);

  const toggle = useCallback(async () => {
    if (isFullscreen || fallback) await exit();
    else await enter();
  }, [enter, exit, fallback, isFullscreen]);

  const active = isFullscreen || fallback;

  return { ref, active, toggle, enter, exit };
}
