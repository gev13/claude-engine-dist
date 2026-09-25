import { describe, expect, it } from 'vitest';
import { bentoSpans } from '@/components/blocks/index';
import { blockSchemas } from '@/lib/blocks';
import { resolveBlog } from '@/lib/blog';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 2.22 — picture rows, the bento grid, glowing and ruled stats, check lists
   on circles and in cards, a line beside a form's button, the blog's bar and
   featured post, the category index and a round "Read more". Each is
   nothing until chosen. */

describe('the bento grid', () => {
  it('gives each card its twelfths, row after row in the pattern', () => {
    expect(bentoSpans('2-3', 7)).toEqual([6, 6, 4, 4, 4, 6, 6]);
    expect(bentoSpans('3-2', 5)).toEqual([4, 4, 4, 6, 6]);
  });

  it('shares the last row among the cards it has', () => {
    expect(bentoSpans('2-3', 4)).toEqual([6, 6, 6, 6]);
    expect(bentoSpans('4', 3)).toBeNull(); // one count alone is the even grid
  });

  it('is nothing without a pattern, and refuses one that is not', () => {
    expect(bentoSpans(undefined, 6)).toBeNull();
    expect(blockSchemas.cardGrid.safeParse({ cards: [], pattern: '2-9' }).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse({ cards: [], pattern: '2-3' }).success).toBe(true);
  });
});

describe('the new options', () => {
  it('start unset, so stored blocks are unchanged', () => {
    const grid = blockSchemas.cardGrid.parse({ cards: [] });
    expect([grid.numbered, grid.pattern]).toEqual([undefined, undefined]);
    const stats = blockSchemas.stats.parse({ items: [] });
    expect([stats.glow, stats.dividers]).toEqual([undefined, undefined]);
    const lists = blockSchemas.checkLists.parse({ lists: [] });
    expect([lists.markerStyle, lists.thinRules, lists.boxed]).toEqual([undefined, undefined, undefined]);
    expect(resolveBlog(undefined)).toMatchObject({ searchInBar: false, featured: false });
  });

  it('take the picture rows as a card grid layout', () => {
    expect(blockSchemas.cardGrid.parse({ variant: 'mediaRows', cards: [{ title: 'APT simulation', imageUrl: '/media/a.webp', href: '/services/apt' }] }).variant).toBe('mediaRows');
  });

  it('keep the note beside a form’s button short', () => {
    const form = { formName: 'Contact', fields: [{ id: 'fname001', type: 'text', label: 'Name' }] };
    expect(blockSchemas.form.safeParse(form).success).toBe(true);
    expect(blockSchemas.form.safeParse({ ...form, submitNote: 'We reply within one working day' }).success).toBe(true);
    expect(blockSchemas.form.safeParse({ ...form, submitNote: 'x'.repeat(161) }).success).toBe(false);
  });
});

describe('the category index', () => {
  it('lists the blog’s categories, numbered, two to a row, unless told otherwise', () => {
    expect(blockSchemas.categoryIndex.parse({})).toMatchObject({ source: 'blog', numbered: true, descriptions: true, columns: 2, limit: 12 });
    expect(blockSchemas.categoryIndex.safeParse({ source: 'tags' }).success).toBe(false);
  });
});

describe('“Read more” on a circle', () => {
  it('is drawn only when chosen', () => {
    expect(themeToCss(themeSchema.parse({}))).not.toContain('he-more__icon');
    const out = themeToCss(themeSchema.parse({ buttons: { more: 'circle' } }));
    expect(out).toMatch(/\.he-more__icon\{display:inline-grid;[^}]*border-radius:50%/);
  });
});
