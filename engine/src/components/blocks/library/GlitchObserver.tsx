'use client';

import { useEffect } from 'react';

/**
 * 3.0 — arms the glitch on the headings of blocks that asked for it.
 *
 * Rendered once per page, only when a block uses it. The copies the effect
 * draws are CSS pseudo-elements, so all this does is hand them the words
 * (`data-glitch-text`), the colour behind the heading for the copies to be
 * painted on, and where a stretched line should stay anchored — then run the
 * animation only while the heading is on screen. Before it runs, and without
 * script, the heading is simply the heading.
 */
export function GlitchObserver() {
  useEffect(() => {
    const targets: HTMLElement[] = [];
    for (const block of document.querySelectorAll<HTMLElement>('.he-glitch')) {
      // A block inside a glitching row that glitches itself looks after its own headings.
      const headings = [...block.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')].filter(
        (heading) => heading.parentElement?.closest('.he-glitch') === block,
      );
      for (const heading of block.dataset.glitch === 'all' ? headings : headings.slice(0, 1)) {
        const text = heading.textContent?.replace(/\s+/g, ' ').trim();
        if (!text || heading.classList.contains('he-glitch-t')) continue;
        heading.dataset.glitchText = text;
        if (!getComputedStyle(heading).getPropertyValue('--he-glitch-bg').trim()) {
          heading.style.setProperty('--he-glitch-bg', backdrop(heading));
        }
        heading.style.setProperty('--he-glitch-origin', origin(getComputedStyle(heading).textAlign));
        heading.classList.add('he-glitch-t');
        targets.push(heading);
      }
    }
    if (!targets.length) return;

    /* 3.5 — a block set to `interval` glitches in bursts: one as it comes on
       screen, then one every `every` seconds, each `burst` seconds long, and
       nothing while it is off screen. */
    const timers = new Map<Element, () => void>();
    const startBursts = (heading: HTMLElement, block: HTMLElement) => {
      const every = Math.max(1, Number(block.dataset.glitchEvery) || 5) * 1000;
      const burst = Math.max(0.2, Number(block.dataset.glitchBurst) || 1) * 1000;
      let off = 0;
      const fire = () => {
        heading.classList.add('he-glitch-live');
        window.clearTimeout(off);
        off = window.setTimeout(() => heading.classList.remove('he-glitch-live'), Math.min(burst, every));
      };
      fire();
      const loop = window.setInterval(fire, every);
      timers.set(heading, () => {
        window.clearInterval(loop);
        window.clearTimeout(off);
        heading.classList.remove('he-glitch-live');
      });
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const heading = entry.target as HTMLElement;
        const block = heading.closest<HTMLElement>('.he-glitch');
        if (block?.classList.contains('he-glitch--interval')) {
          if (entry.isIntersecting && !timers.has(heading)) startBursts(heading, block);
          if (!entry.isIntersecting && timers.has(heading)) {
            timers.get(heading)?.();
            timers.delete(heading);
          }
          continue;
        }
        heading.classList.toggle('he-glitch-live', entry.isIntersecting);
      }
    });
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      timers.forEach((stop) => stop());
      timers.clear();
      for (const target of targets) {
        target.classList.remove('he-glitch-t', 'he-glitch-live');
        delete target.dataset.glitchText;
        target.style.removeProperty('--he-glitch-bg');
        target.style.removeProperty('--he-glitch-origin');
      }
    };
  }, []);

  return null;
}

/**
 * The first solid colour behind an element. A picture or a gradient on the
 * way up cannot be matched by a flat copy, so the copies are then left
 * transparent — the tear still shows, over the words rather than instead of them.
 */
function backdrop(element: HTMLElement): string {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none') return 'transparent';
    if (!isClear(style.backgroundColor)) return style.backgroundColor;
  }
  return 'transparent';
}

const isClear = (colour: string) => !colour || colour === 'transparent' || /rgba?\([^)]*[,/]\s*0\s*\)$/.test(colour);

/** A stretched line keeps the edge it is set against. */
function origin(align: string): string {
  if (align === 'center') return '50% 50%';
  if (align === 'right' || align === 'end') return '100% 50%';
  return '0 50%';
}
