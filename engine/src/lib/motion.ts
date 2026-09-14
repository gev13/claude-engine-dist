/**
 * Whether this visitor wants less motion: their operating system says so, or
 * they flipped the site's own switch (GL3), which stamps `he-reduce-motion` on
 * <html>. Everything that moves by itself — sliders, marquees, reveals —
 * checks this before starting, and listens for MOTION_EVENT to stop mid-way.
 */
export function motionReduced(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('he-reduce-motion')
  );
}

/** Fired on window when the site's reduce-motion switch changes. */
export const MOTION_EVENT = 'he-motion-change';

/**
 * Applies the visitor's saved choices before first paint, so a reload never
 * flashes the wrong palette or a moving hero. Inlined into the site layout;
 * the CSP already allows inline scripts for Next's own bootstrap.
 */
export const PREFS_SCRIPT =
  "try{var d=document.documentElement,s=window.localStorage;if(s.getItem('he-motion')==='reduce')d.classList.add('he-reduce-motion');if(s.getItem('he-scheme')==='alt')d.setAttribute('data-scheme','alt')}catch(e){}";
