import { describe, expect, it } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss, blocksStyleToCss, isSafeBlockId } from '@/lib/blockStyle-css';
import { parseBlock } from '@/lib/blocks';

const parse = (input: unknown) => blockStyleSchema.parse(input);

describe('section style schema', () => {
  it('rejects a length that is not a length', () => {
    expect(blockStyleSchema.safeParse({ spacing: { base: { paddingTop: '40px' } } }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ spacing: { base: { paddingTop: '40 px' } } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ spacing: { base: { paddingTop: 'calc(100% - 2px)' } } }).success).toBe(false);
  });

  it('constrains an anchor to something usable as an id', () => {
    expect(blockStyleSchema.safeParse({ anchorId: 'pricing' }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ anchorId: '2pricing' }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ anchorId: 'a b' }).success).toBe(false);
  });
});

describe('section style to CSS', () => {
  it('emits nothing for a block with no style', () => {
    expect(blockStyleToCss('abc', undefined)).toBe('');
    expect(blockStyleToCss('abc', parse({}))).toBe('');
  });

  it('scopes every rule to the block class', () => {
    const css = blockStyleToCss('b1', parse({ spacing: { base: { paddingTop: '40px' } } }));
    expect(css).toBe('.he-b-b1{padding-top:40px}.he-b-b1>*,.he-b-b1>*>.shell{padding-top:0}');
  });

  it('puts a breakpoint override in a media query', () => {
    const css = blockStyleToCss(
      'b1',
      parse({ spacing: { base: { paddingTop: '80px' }, mobile: { paddingTop: '24px' } } }),
    );
    expect(css).toContain('.he-b-b1{padding-top:80px}');
    expect(css).toContain('@media (max-width:768px){.he-b-b1{padding-top:24px}');
  });

  /* ── The band steps aside ───────────────────────────────────────────────────
     A block paints a full-bleed band with its own padding, in a layer; the
     wrapper these rules style sits outside it. Without flattening the band the
     two add up, and a padding of 0 does nothing whatsoever — which is what
     "I can't edit this section's padding" turned out to mean.
     ───────────────────────────────────────────────────────────────────────── */

  it('flattens the band on the sides a padding was set, and only those', () => {
    const css = blockStyleToCss('b1', parse({ spacing: { base: { paddingTop: '0px' } } }));
    expect(css).toContain('.he-b-b1>*,.he-b-b1>*>.shell{padding-top:0}');
    // The sides nobody touched keep the block's own rhythm.
    expect(css).not.toContain('padding-bottom');
  });

  it('leaves the band alone when only a margin was set', () => {
    const css = blockStyleToCss('b1', parse({ spacing: { base: { marginTop: '40px' } } }));
    expect(css).toBe('.he-b-b1{margin-top:40px}');
  });

  it('flattens the band per breakpoint, not once for all of them', () => {
    const css = blockStyleToCss('b1', parse({ spacing: { mobile: { paddingTop: '0px' } } }));
    expect(css).toContain('@media (max-width:768px){.he-b-b1{padding-top:0px}.he-b-b1>*,.he-b-b1>*>.shell{padding-top:0}}');
    // Nothing outside the media query: the wider widths were not asked about.
    expect(css.startsWith('@media')).toBe(true);
  });

  it('drops the band’s own rule when the editor takes charge of the border', () => {
    expect(blockStyleToCss('b1', parse({ border: { bottomWidth: '4px' } }))).toContain('.he-b-b1>*{border-width:0}');
    expect(blockStyleToCss('b1', parse({ border: { style: 'dashed' } }))).toContain('.he-b-b1>*{border-width:0}');
    // A radius or a colour describes a border rather than asking for one.
    expect(blockStyleToCss('b1', parse({ border: { radius: '8px' } }))).not.toContain('border-width:0');
  });

  /* A column's children are whole blocks; their bands are not the column's to
     flatten, so the column prefix never emits the escape hatch. */
  it('never flattens a band from a column’s own style', () => {
    const css = blockStyleToCss('colA', parse({ spacing: { base: { paddingTop: '40px' } } }), 'he-c');
    expect(css).toBe('.he-c-colA{padding-top:40px}');
  });

  /* ── Swiping sideways ───────────────────────────────────────────────────────
     A grid on a desktop, a scroll-snap track under a thumb. CSS only, so every
     card stays in the DOM and in the tab order — and a row keeps its grid
     somewhere else from every other block, which is the whole reason
     `blockStyleToCss` has to be told which it is looking at.
     ───────────────────────────────────────────────────────────────────────── */

  it('turns a block’s grid into a track below the chosen width', () => {
    const css = blockStyleToCss('b1', parse({ swipeOn: 'mobile' }));
    expect(css).toContain('@media (max-width:768px)');
    expect(css).toContain('.he-b-b1 [class*="grid-cols-"]{display:flex');
    expect(css).toContain('scroll-snap-type:x mandatory');
    expect(css).toContain('scroll-snap-align:start');
    // Never at the wider widths.
    expect(css).not.toContain('max-width:1440px');
    expect(css).not.toContain('max-width:1024px');
  });

  it('aims at a row’s own grid, not at the grids of the blocks inside it', () => {
    const row = blockStyleToCss('r1', parse({ swipeOn: 'mobile' }), 'he-b', true);
    expect(row).toContain('.he-b-r1>.shell>[class^="he-r-"]{display:flex');
    /* The child-combinator path is exact, so a swipe set on an outer row
       cannot reach a row nested inside it — and it never matches the
       `grid-cols-*` of a card grid sitting in one of its columns. */
    expect(row).not.toContain('grid-cols-');
  });

  it('says which way the track runs, because reverseOnMobile has an opinion', () => {
    // `rowToCss` already emits `flex-direction:column-reverse` at this width
    // for a reversed row; swiping wins, and has to say so.
    expect(blockStyleToCss('r1', parse({ swipeOn: 'mobile' }), 'he-b', true)).toContain('flex-direction:row');
  });

  it('follows the width it was given, not always the phone', () => {
    expect(blockStyleToCss('b1', parse({ swipeOn: 'tablet' }))).toContain('@media (max-width:1024px)');
    expect(blockStyleToCss('b1', parse({ swipeOn: 'laptop' }))).toContain('@media (max-width:1440px)');
  });

  it('emits nothing when nobody asked for it', () => {
    expect(blockStyleToCss('b1', parse({ hideOn: ['mobile'] }))).not.toContain('scroll-snap');
    expect(blockStyleSchema.safeParse({ swipeOn: 'phone' }).success).toBe(false);
  });

  it('hides a block at the widths it was told to', () => {
    const css = blockStyleToCss('b1', parse({ hideOn: ['mobile'] }));
    expect(css).toContain('@media (max-width:768px){.he-b-b1{display:none}}');
    expect(css).not.toContain('max-width:1440px');
  });

  it('scopes a typography override to the tags it applies to', () => {
    const css = blockStyleToCss('b1', parse({ typography: { heading: { align: 'center' } } }));
    expect(css).toBe('.he-b-b1 :is(h1,h2,h3,h4,h5,h6){text-align:center}');
  });

  /* The id becomes part of a selector, and the values become declarations, so
     both are attacker-controlled input into a <style> element. */
  it('refuses to build a selector from an unsafe id', () => {
    expect(isSafeBlockId('ok-id_1')).toBe(true);
    expect(isSafeBlockId('a}b')).toBe(false);
    expect(blockStyleToCss('x{}</style><script>', parse({ spacing: { base: { paddingTop: '1px' } } }))).toBe('');
  });

  it('refuses a background url that could close the url() call', () => {
    expect(blockStyleToCss('b1', parse({ background: { imageUrl: '/media/a.png' } }))).toContain(
      'background-image:url("/media/a.png")',
    );
    expect(blockStyleToCss('b1', parse({ background: { imageUrl: 'x");background:red;a("' } }))).toBe('');
    expect(blockStyleToCss('b1', parse({ background: { imageUrl: 'javascript:alert(1)' } }))).toBe('');
  });

  it('concatenates every styled block on a page', () => {
    const css = blocksStyleToCss([
      { id: 'a', style: parse({ spacing: { base: { paddingTop: '10px' } } }) },
      { id: 'b', style: undefined },
      { id: 'c', style: parse({ spacing: { base: { paddingTop: '20px' } } }) },
    ]);
    expect(css).toBe(
      '.he-b-a{padding-top:10px}.he-b-a>*,.he-b-a>*>.shell{padding-top:0}.he-b-c{padding-top:20px}.he-b-c>*,.he-b-c>*>.shell{padding-top:0}',
    );
  });
});

describe('effects (package 3, phase C)', () => {
  it('keeps every effect to a closed list', () => {
    expect(blockStyleSchema.safeParse({ reveal: 'zoom', revealDelay: 300, hover: 'tilt', sticky: true, snap: true }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ revealDelay: 250 }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ hover: 'wobble' }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ shapeTop: { kind: 'wave', height: 'large', flip: true } }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ shapeTop: { kind: 'blob' } }).success).toBe(false);
  });

  it('draws a gradient only from real colours, and stills it for reduced motion', () => {
    const css = blockStyleToCss('b1', parse({ background: { gradient: { from: '#111111', to: '#ec3013', angle: '90', animate: true } } }));
    expect(css).toContain('background-image:linear-gradient(90deg,#111111,#ec3013)');
    expect(css).toContain('animation:he-grad');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.he-b-b1{animation:none}}');
    expect(blockStyleSchema.safeParse({ background: { gradient: { from: 'red;x', to: '#fff' } } }).success).toBe(false);
  });

  it('lets a chosen background show through the block’s own band', () => {
    expect(blockStyleToCss('b1', parse({ background: { color: '#123456' } }))).toContain('.he-b-b1>*{background:transparent}');
    expect(blockStyleToCss('b1', parse({ spacing: { base: { paddingTop: '4px' } } }))).not.toContain('transparent');
  });
});

describe('block parsing with a style', () => {
  it('keeps a valid style beside the props', () => {
    const block = parseBlock({
      id: 'x1',
      type: 'cta',
      props: { title: 'Hello' },
      style: { width: 'wide', spacing: { base: { paddingTop: '40px' } } },
    });
    expect(block?.style?.width).toBe('wide');
  });

  /* The whole point of separating the two: a bad style must cost the styling,
     never the content. */
  it('renders the block unstyled when the style is malformed', () => {
    const block = parseBlock({
      id: 'x1',
      type: 'cta',
      props: { title: 'Hello' },
      style: { spacing: { base: { paddingTop: 'nonsense' } } },
    });
    expect(block).not.toBeNull();
    expect(block?.props).toMatchObject({ title: 'Hello' });
    expect(block?.style).toBeUndefined();
  });

  it('leaves an unstyled block with no style at all', () => {
    const block = parseBlock({ id: 'x1', type: 'cta', props: { title: 'Hello' } });
    expect(block?.style).toBeUndefined();
  });
});

describe('publish scheduling', () => {
  /* Posts always honoured a future `publishedAt`; pages did not, so a page
     scheduled for next week went live the moment it was saved. */
  it('uses the same predicate shape for pages and posts', async () => {
    const pagesSrc = await import('node:fs').then((fs) =>
      fs.readFileSync('src/server/content/pages.ts', 'utf8'),
    );
    const postsSrc = await import('node:fs').then((fs) =>
      fs.readFileSync('src/server/content/posts.ts', 'utf8'),
    );
    for (const src of [pagesSrc, postsSrc]) {
      expect(src).toContain('publishedAt} is not null and');
      expect(src).toContain('<= now()');
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   A bare number means pixels
   ───────────────────────────────────────────────────────────────────────────
   Typing `56` in a padding field is what everybody does. It used to be
   accepted, stored, and emitted as `padding-top: 56` — not valid CSS, so the
   browser dropped the declaration and the padding simply never appeared, with
   nothing anywhere saying why. A site shipped like that.

   The completion happens at the schema, which is what makes values *already
   saved* as `56` start working on the next render instead of needing to be
   typed again.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('lengths without a unit', () => {
  it('completes a bare number to pixels', () => {
    const style = parse({ spacing: { base: { paddingTop: '56', marginBottom: '12' } } });
    expect(style.spacing?.base?.paddingTop).toBe('56px');
    expect(style.spacing?.base?.marginBottom).toBe('12px');
  });

  it('repairs what is already stored, without a migration', () => {
    // Exactly the shape sitting in a live site's `blocks` column.
    const css = blockStyleToCss('b1', parse({ spacing: { base: { paddingTop: '12' } } }));
    expect(css).toContain('padding-top:12px');
    expect(css).not.toContain('padding-top:12;');
  });

  it('leaves zero alone, which is legal CSS on its own', () => {
    expect(parse({ spacing: { base: { paddingTop: '0' } } }).spacing?.base?.paddingTop).toBe('0');
  });

  it('leaves a value that already has a unit exactly as written', () => {
    const style = parse({
      spacing: { base: { paddingTop: '1.5rem', paddingBottom: 'clamp(20px, 3vw, 40px)' } },
    });
    expect(style.spacing?.base?.paddingTop).toBe('1.5rem');
    expect(style.spacing?.base?.paddingBottom).toBe('clamp(20px, 3vw, 40px)');
  });

  it('still refuses something that is not a length at all', () => {
    expect(blockStyleSchema.safeParse({ spacing: { base: { paddingTop: '56 px' } } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ spacing: { base: { paddingTop: 'wide' } } }).success).toBe(false);
  });

  /* Last line of defence. Even if something unitless reached the generator,
     it must never become a declaration the browser will throw away. */
  it('never emits a unitless length, whatever it is handed', () => {
    const smuggled = { spacing: { base: { paddingTop: '56' } } } as never;
    expect(blockStyleToCss('b1', smuggled)).not.toContain('padding-top:56}');
  });
});
