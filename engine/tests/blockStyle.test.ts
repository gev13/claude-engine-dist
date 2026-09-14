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
    expect(css).toBe('.he-b-b1{padding-top:40px}');
  });

  it('puts a breakpoint override in a media query', () => {
    const css = blockStyleToCss(
      'b1',
      parse({ spacing: { base: { paddingTop: '80px' }, mobile: { paddingTop: '24px' } } }),
    );
    expect(css).toContain('.he-b-b1{padding-top:80px}');
    expect(css).toContain('@media (max-width:768px){.he-b-b1{padding-top:24px}}');
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
    expect(css).toBe('.he-b-a{padding-top:10px}.he-b-c{padding-top:20px}');
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
