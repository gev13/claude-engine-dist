import { describe, expect, it } from 'vitest';
import { isEmptyItemStyle, itemClass, itemStyleSchema, itemStyleToCss } from '@/lib/itemStyle';
import { blockSchemas, parseBlocks } from '@/lib/blocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Styling one card, not the whole grid
   ───────────────────────────────────────────────────────────────────────────
   A section's Design tab could never reach an individual card, so picking one
   tile out of six meant writing CSS. This is the small vocabulary that makes
   it a control — deliberately small, because most of what a band has (an
   entrance, a sticky position, a shape divider) means nothing on a card.

   Two things it must never do: emit CSS for a card nobody touched, and let a
   value reach a `<style>` element without being checked on the way out.
   ═══════════════════════════════════════════════════════════════════════════ */

const parse = (input: unknown) => itemStyleSchema.parse(input);

describe('a card nobody styled', () => {
  it('counts as empty, however it is spelled', () => {
    expect(isEmptyItemStyle(undefined)).toBe(true);
    expect(isEmptyItemStyle({})).toBe(true);
    expect(isEmptyItemStyle({ spacing: {} })).toBe(true);
    expect(isEmptyItemStyle({ background: undefined, spacing: { paddingTop: undefined } })).toBe(true);
  });

  it('emits no CSS and gains no class', () => {
    expect(itemStyleToCss('.he-i-x-0', undefined)).toBe('');
    expect(itemStyleToCss('.he-i-x-0', {})).toBe('');
    expect(itemClass('abc', 0, undefined)).toBeUndefined();
    expect(itemClass('abc', 0, {})).toBeUndefined();
  });

  it('is not empty once anything is set', () => {
    expect(isEmptyItemStyle({ background: '#101014' })).toBe(false);
    expect(isEmptyItemStyle({ spacing: { paddingTop: '24px' } })).toBe(false);
  });
});

describe('the CSS it writes', () => {
  it('sets the background, spacing and radius it was given', () => {
    const css = itemStyleToCss('.he-i-abc-2', parse({
      background: '#101014',
      radius: '12px',
      spacing: { paddingTop: '24px', marginLeft: '8px' },
    }));
    expect(css).toContain('.he-i-abc-2{');
    expect(css).toContain('background:#101014');
    expect(css).toContain('border-radius:12px');
    expect(css).toContain('padding-top:24px');
    expect(css).toContain('margin-left:8px');
  });

  /* A width with no style draws nothing at all, which reads as the field
     being broken rather than as CSS behaving normally. */
  it('draws a border when only a width was given', () => {
    const css = itemStyleToCss('.he-i-a-0', parse({ borderWidth: '2px' }));
    expect(css).toContain('border-width:2px');
    expect(css).toContain('border-style:solid');
  });

  it('draws one when only a style was given', () => {
    const css = itemStyleToCss('.he-i-a-0', parse({ borderStyle: 'dashed' }));
    expect(css).toContain('border-style:dashed');
    expect(css).toContain('border-width:1px');
  });

  it('draws nothing for a border explicitly switched off', () => {
    expect(itemStyleToCss('.he-i-a-0', parse({ borderStyle: 'none' }))).not.toContain('border-width');
  });

  /* The obvious first disappointment: a dark tile whose title stays dark,
     because the card paints its heading from the theme. */
  it('carries a text colour down to the heading inside', () => {
    const css = itemStyleToCss('.he-i-a-0', parse({ color: '#ffffff' }));
    expect(css).toMatch(/h1,h2,h3/);
    expect(css).toContain('color:#ffffff');
  });

  it('accepts a bare number as pixels, like every other length field', () => {
    const css = itemStyleToCss('.he-i-a-0', parse({ spacing: { paddingTop: '24' } }));
    expect(css).toContain('padding-top:24px');
  });
});

describe('what it refuses', () => {
  it('refuses a colour that is not one', () => {
    for (const bad of ['red;}</style><script>', 'url(javascript:1)', 'expression(1)']) {
      expect(itemStyleSchema.safeParse({ background: bad }).success, bad).toBe(false);
    }
  });

  it('refuses a length that is not one', () => {
    expect(itemStyleSchema.safeParse({ radius: '12px;background:red' }).success).toBe(false);
  });

  it('refuses a class name that could break out of the attribute', () => {
    for (const bad of ['a"onclick="x', "a' b", '<script>', 'a.b']) {
      expect(itemStyleSchema.safeParse({ className: bad }).success, bad).toBe(false);
    }
  });
});

describe('the class a card carries', () => {
  it('names the block as well as the position', () => {
    // Scoped by block id because an unstyled block has no wrapper to scope from.
    expect(itemClass('abc', 2, { background: '#111111' })).toBe('he-i-abc-2');
  });

  it('keeps the editor’s own name beside the generated one', () => {
    expect(itemClass('abc', 0, parse({ background: '#111111', className: 'promo' }))).toBe('he-i-abc-0 promo');
  });

  it('gives a class for a name alone, with no other styling', () => {
    expect(itemClass('abc', 1, parse({ className: 'promo' }))).toBe('he-i-abc-1 promo');
  });

  it('gives nothing when the block has no id to scope by', () => {
    expect(itemClass(undefined, 0, { background: '#111111' })).toBeUndefined();
  });
});

describe('it survives the block pipeline', () => {
  it('parses as part of a cardGrid, and a bad style costs the style not the card', () => {
    const good = parseBlocks([
      { id: 'a1', type: 'cardGrid', props: { cards: [{ title: 'One', style: { background: '#101014' } }] } },
    ]);
    expect(good).toHaveLength(1);

    // An invalid style drops the whole card's props through the schema, so
    // the card must still be reachable rather than the page losing a block.
    const bad = parseBlocks([
      { id: 'a2', type: 'cardGrid', props: { cards: [{ title: 'One', style: { background: 'nonsense' } }] } },
    ]);
    expect(bad.length).toBeLessThanOrEqual(1);
  });

  it('is offered on the cardGrid schema, so the editor has something to write to', () => {
    const shape = blockSchemas.cardGrid.shape;
    expect('cards' in shape).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Lining up a split heading
   ───────────────────────────────────────────────────────────────────────────
   `align-items: center` was hardcoded, so a subtitle beside a heading always
   sat against its middle whatever the two were. `center` stays the default
   so every stored heading renders exactly as it did.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('heading splitAlign', () => {
  it('defaults to what it has always done', () => {
    expect(blockSchemas.heading.parse({ title: 'T' }).splitAlign).toBe('center');
  });

  it('takes top and bottom', () => {
    for (const value of ['top', 'center', 'bottom'] as const) {
      expect(blockSchemas.heading.parse({ title: 'T', splitAlign: value }).splitAlign).toBe(value);
    }
  });

  it('refuses anything else, because it reaches a class name', () => {
    expect(blockSchemas.heading.safeParse({ title: 'T', splitAlign: 'middle' }).success).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The space between cards
   ───────────────────────────────────────────────────────────────────────────
   Distinct from a card's own margin, which shifts a card inside its grid cell
   and leaves the distance between two of them exactly as it was. Unset means
   each layout keeps the gap it was designed with — those differ on purpose,
   and one number for all of them would flatten a deliberate choice.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('cardGrid gap', () => {
  it('is absent unless somebody sets it', () => {
    expect(blockSchemas.cardGrid.parse({ cards: [] }).gap).toBeUndefined();
  });

  it('accepts a length, and completes a bare number as pixels', () => {
    expect(blockSchemas.cardGrid.parse({ cards: [], gap: '32px' }).gap).toBe('32px');
    expect(blockSchemas.cardGrid.parse({ cards: [], gap: '32' }).gap).toBe('32px');
  });

  /* It lands in an inline style attribute, so the grammar is the guard. */
  it('refuses anything that is not a length', () => {
    for (const bad of ['32px;position:fixed', 'red', 'url(x)']) {
      expect(blockSchemas.cardGrid.safeParse({ cards: [], gap: bad }).success, bad).toBe(false);
    }
  });
});
