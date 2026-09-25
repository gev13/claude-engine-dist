import { z } from 'zod';
import { blockStyleSchema } from '@/lib/blockStyle';

/** Shared request-shape vocabulary for the admin API. */

export const statusEnum = z.enum(['draft', 'published', 'archived']);

export const seoSchema = z.object({
  title: z.string().max(300).optional(),
  exactTitle: z.boolean().optional(),
  description: z.string().max(1000).optional(),
  canonicalUrl: z.string().max(500).optional(),
  robots: z.string().max(120).optional(),
  ogTitle: z.string().max(300).optional(),
  ogDescription: z.string().max(1000).optional(),
  ogImageId: z.string().max(64).optional(),
  twitterCard: z.enum(['summary', 'summary_large_image']).optional(),
  /** Objects only, each a schema.org node; rendered into the page's graph (2.18). */
  jsonLd: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  extraMeta: z
    .array(z.object({ name: z.string().optional(), property: z.string().optional(), content: z.string() }))
    .max(40)
    .optional(),
});

export const blockInput = z.object({
  /**
   * The id becomes part of a CSS selector (`.he-b-<id>`), so it is constrained
   * to what is safe there rather than to "any short string".
   */
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Block ids may contain letters, digits, - and _ only'),
  type: z.string().min(1).max(60),
  props: z.record(z.string(), z.unknown()).default({}),
  /**
   * Validated here rather than left to the renderer: `parseBlock` drops a bad
   * style silently, which would mean an editor's spacing quietly not applying
   * with nothing to explain why.
   */
  style: blockStyleSchema.optional(),
});

/** Standard list-endpoint query parameters. */
export function readListParams(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage') ?? '20') || 20));
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const status = url.searchParams.get('status') ?? '';
  return { page, perPage, offset: (page - 1) * perPage, q, status };
}

export type ListResult<T> = { items: T[]; total: number; page: number; perPage: number };
