import slugify from 'slugify';

/** URL-safe, lowercase, ASCII. Empty input yields a stable fallback. */
export function toSlug(input: string, fallback = 'untitled'): string {
  const slug = slugify(input, { lower: true, strict: true, trim: true, locale: 'en' }).slice(0, 180);
  return slug || fallback;
}

/** Append -2, -3 … until the slug is not in `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** A page path from a slug plus optional parent path. */
export function toPath(slug: string, parentPath?: string | null): string {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  if (!parentPath || parentPath === '/') return `/${clean}`;
  return `${parentPath.replace(/\/+$/, '')}/${clean}`;
}
