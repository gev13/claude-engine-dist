/* ═══════════════════════════════════════════════════════════════════════════
   Pulling the words out of a block tree, and putting them back
   ───────────────────────────────────────────────────────────────────────────
   A translated page is a copy of the original with the same blocks, the same
   pictures and the same layout — and different words. So translating one does
   not mean rebuilding it: it means finding every piece of text inside the
   block tree, showing it beside a box to type the translation into, and
   writing the result back where it came from.

   Which strings count is decided by **excluding** the technical ones rather
   than listing the text ones. Missing a key in an allowlist would mean a
   sentence a translator cannot reach, with nothing to indicate why; a
   technical string slipping through is visible, harmless and obvious.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Keys whose values are never prose: identifiers, enums, geometry, addresses.
 * Enum values are covered by this alone — they always live under one of these.
 */
const TECHNICAL_KEYS = new Set([
  'id',
  'type',
  'variant',
  'style',
  'layout',
  'align',
  'size',
  'width',
  'height',
  'ratio',
  'kind',
  'icon',
  'url',
  'href',
  'src',
  'imageUrl',
  'videoUrl',
  'posterUrl',
  'logoUrl',
  'faviconUrl',
  'coverUrl',
  'fileUrl',
  'anchor',
  'slug',
  'color',
  'colour',
  'background',
  'direction',
  'position',
  'shape',
  'trigger',
  'speed',
  'separator',
  'hover',
  'titleAs',
  'mode',
  'source',
  'network',
  'perView',
  'gap',
  'tone',
  'preset',
  /* `columns` is deliberately NOT here, and this cost a bug: in most blocks it
     is a number of grid tracks, but in `row` it is the array holding every
     nested block — excluding it skipped the entire recursive half of the
     vocabulary. A number is never collected anyway, because only strings are. */
  'template',
  'locale',
  'format',
  'timeZone',
  'target',
  'rel',
  'pattern',
  'field',
  /* `name` is deliberately NOT here. Blocks use it for people, logos, team
     members and chart series — all of it user-facing, and transliterated
     rather than left alone in Armenian or Russian. Form fields are keyed by
     `label`, not by `name`, so nothing breaks by translating it. */
]);

/** Values that are plainly not prose, whatever key they arrived under. */
function looksTechnical(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^(\/|\.\/|mailto:|tel:|#)/.test(trimmed)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return true;
  // Numbers, dates, percentages and the like carry no language.
  if (/^[\d\s.,:%+\-/]+$/.test(trimmed)) return true;
  return false;
}

export type TranslatableString = {
  /** Dotted path into the tree, e.g. `0.props.items.2.label`. */
  path: string;
  /** The key it sat under, so the editor can label the field. */
  key: string;
  value: string;
};

/**
 * Every translatable string in a value, in document order.
 *
 * The `row` block nests other blocks inside columns; nothing special is needed
 * for it, because a block tree is only objects and arrays and this walks both.
 */
export function collectStrings(value: unknown, basePath = ''): TranslatableString[] {
  const found: TranslatableString[] = [];

  const walk = (node: unknown, path: string, key: string) => {
    if (typeof node === 'string') {
      if (!TECHNICAL_KEYS.has(key) && !looksTechnical(node)) {
        found.push({ path, key, value: node });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, path ? `${path}.${index}` : String(index), key));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [childKey, childValue] of Object.entries(node as Record<string, unknown>)) {
        // A technical key's whole subtree is technical: `style` holds spacing
        // and colours, never sentences.
        if (TECHNICAL_KEYS.has(childKey) && typeof childValue === 'object') continue;
        walk(childValue, path ? `${path}.${childKey}` : childKey, childKey);
      }
    }
  };

  walk(value, basePath, '');
  return found;
}

/**
 * Write translations back, by path. Anything without a translation keeps the
 * original — a half-finished translation renders as a half-translated page
 * rather than a page with holes in it.
 */
export function applyStrings<T>(value: T, translations: Record<string, string>): T {
  const walk = (node: unknown, path: string, key: string): unknown => {
    if (typeof node === 'string') {
      const replacement = translations[path];
      return typeof replacement === 'string' && replacement !== '' ? replacement : node;
    }
    if (Array.isArray(node)) {
      return node.map((item, index) => walk(item, path ? `${path}.${index}` : String(index), key));
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(node as Record<string, unknown>)) {
        out[childKey] = walk(childValue, path ? `${path}.${childKey}` : childKey, childKey);
      }
      return out;
    }
    return node;
  };

  return walk(value, '', '') as T;
}

/**
 * How much of a block tree has been translated, as a count rather than a
 * percentage — "9 of 24 left" is actionable in a way that "62%" is not.
 */
export function translationProgress(
  source: unknown,
  target: unknown,
): { total: number; translated: number; remaining: number } {
  const sourceStrings = collectStrings(source);
  const targetByPath = new Map(collectStrings(target).map((entry) => [entry.path, entry.value]));

  let translated = 0;
  for (const entry of sourceStrings) {
    const other = targetByPath.get(entry.path);
    // Unchanged means untranslated: a translator has not been there yet.
    if (typeof other === 'string' && other !== '' && other !== entry.value) translated += 1;
  }

  return { total: sourceStrings.length, translated, remaining: sourceStrings.length - translated };
}
