'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Scales an iframe's rendered document down to fit its wrapper's width, and sizes the
// wrapper to match the scaled content height exactly — so a live HTML preview (e.g. a
// certificate template) never needs its own scrollbar, no matter how large the source
// document actually is. Only ever shrinks (never enlarges) small content.
export default function useScaledIframePreview() {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [wrapHeight, setWrapHeight] = useState(0);

  const recomputeFor = useCallback((width, height) => {
    const wrap = wrapRef.current;
    if (!wrap || !width || !height) return;
    const nextScale = Math.min(1, wrap.clientWidth / width);
    setScale(nextScale);
    setWrapHeight(Math.ceil(height * nextScale));
  }, []);

  const handleLoad = useCallback(() => {
    const iframe = frameRef.current;
    if (!iframe) return;
    try {
      const root = iframe.contentDocument?.documentElement;
      if (!root) return;
      const { scrollWidth: width, scrollHeight: height } = root;
      setContentSize({ width, height });
      recomputeFor(width, height);
    } catch {
      // Not accessible (unexpected cross-origin) — keep whatever size we last had.
    }
  }, [recomputeFor]);

  useEffect(() => {
    const onResize = () => recomputeFor(contentSize.width, contentSize.height);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeFor, contentSize.width, contentSize.height]);

  return {
    wrapRef,
    frameRef,
    handleLoad,
    wrapStyle: { height: wrapHeight || contentSize.height || 520, overflow: 'hidden' },
    frameStyle: {
      width: contentSize.width || 960,
      height: contentSize.height || 520,
      transform: `scale(${scale})`,
      // Scaling from the top-CENTER (paired with `justify-content: center` on the
      // wrapper) keeps the shrunk certificate visually centered either way: when it's
      // narrower than the wrapper, flex centers the box outright; when it's wider,
      // shrinking symmetrically around the center means the scaled result lands
      // exactly back within the wrapper's bounds instead of drifting to one side.
      transformOrigin: 'top center',
    },
  };
}
