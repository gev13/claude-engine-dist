'use client';

import { useEffect, useRef, useState } from 'react';
import { motionReduced } from '@/lib/motion';

/**
 * V10 — a figure that counts up from zero the first time it scrolls into view.
 *
 * The server renders the real value, and so does a visitor who wants less
 * motion or who already has the number on screen: only a figure that starts
 * below the fold is reset to zero, and only on the client. Screen readers get
 * the real value once, never the ticking one.
 */
export function CountUp({ value, enabled = true }: { value: string; enabled?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    setShown(value);
    const el = ref.current;
    const match = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value);
    if (!enabled || !el || !match || motionReduced()) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    const [, prefix = '', digits = '', suffix = ''] = match;
    const decimals = digits.split('.')[1]?.length ?? 0;
    const target = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    const grouped = digits.includes(',');
    const format = (n: number) =>
      grouped
        ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : n.toFixed(decimals);

    setShown(`${prefix}${format(0)}${suffix}`);
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1600);
          setShown(`${prefix}${format(target * (1 - (1 - t) ** 3))}${suffix}`);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, enabled]);

  return (
    <>
      <span ref={ref} aria-hidden="true">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
