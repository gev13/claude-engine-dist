'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    heTagsNavigate?: () => void;
    heTrack?: (name: string, options?: Record<string, unknown>) => void;
  }
}

/**
 * Tells the tag loader about a client-side navigation (2.16): page-targeted
 * snippets for the new page, and a page view for the vendors that do not
 * follow the browser's history by themselves. Not on the first render — the
 * loader counted that page when it started.
 */
export function TagsNavigation() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.heTagsNavigate?.();
  }, [pathname]);
  return null;
}
