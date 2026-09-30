import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Reading time at ~220 wpm, floor of 1. */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** 3.22 — a post's reading time: the one written on it (SEO → reading time), else counted from its text. */
export function postReadingMinutes(html: string, seo: { readingMinutes?: unknown } | null | undefined): number {
  const manual = seo?.readingMinutes;
  return typeof manual === 'number' && Number.isInteger(manual) && manual >= 1 && manual <= 600 ? manual : readingMinutes(html);
}

export function absoluteUrl(path: string, origin: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function isoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
