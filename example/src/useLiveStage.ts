import { useEffect, useRef, useState } from 'react';

/**
 * Same idea as RN `useWindowDimensions`: overlay maps into the full window,
 * and native preview is full-bleed behind the WebView (webView.frame).
 */
export function useLiveStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1,
    h: typeof window !== 'undefined' ? window.innerHeight : 1,
  });

  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return { stageRef, size };
}
