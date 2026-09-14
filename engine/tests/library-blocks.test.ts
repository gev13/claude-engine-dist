import { describe, expect, it } from 'vitest';
import { blockSchemas, parseBlocks } from '../src/lib/blocks';

const slide = { title: 'One' };

describe('hero variants', () => {
  it('keeps a stored hero from before variants existed as the classic hero', () => {
    const parsed = blockSchemas.hero.parse({ title: 'Hello', links: [] });
    expect(parsed.variant).toBe('classic');
  });

  it('accepts a media hero with a video and an announcement pill', () => {
    const parsed = blockSchemas.hero.parse({
      title: 'Hello',
      links: [],
      variant: 'mediaCenter',
      imageUrl: '/media/poster.jpg',
      videoUrl: 'https://cdn.example.com/clip.mp4',
      announcement: { label: 'Join us', href: '/events' },
    });
    expect(parsed.height).toBe('tall');
    expect(parsed.overlay).toBe('medium');
  });

  it('rejects a media URL that could break out of an attribute or stylesheet', () => {
    for (const imageUrl of ['javascript:alert(1)', '/a)b', 'http://insecure.example/x.jpg', '/../etc/passwd']) {
      expect(blockSchemas.hero.safeParse({ title: 'x', links: [], variant: 'split', imageUrl }).success).toBe(false);
    }
  });

  it('rejects an announcement link that is not a safe href', () => {
    const result = blockSchemas.hero.safeParse({
      title: 'x',
      links: [],
      variant: 'mediaCenter',
      announcement: { label: 'Go', href: 'javascript:alert(1)' },
    });
    expect(result.success).toBe(false);
  });
});

describe('carousel', () => {
  it('fills in the shared control defaults', () => {
    const parsed = blockSchemas.carousel.parse({ slides: [slide] });
    expect(parsed).toMatchObject({
      mode: 'cards',
      autoplay: false,
      interval: 6,
      loop: true,
      transition: 'slide',
      indicator: 'dots',
      arrows: 'corner',
      strip: [],
    });
  });

  it('needs at least one slide and caps the count', () => {
    expect(blockSchemas.carousel.safeParse({ slides: [] }).success).toBe(false);
    expect(blockSchemas.carousel.safeParse({ slides: Array.from({ length: 25 }, () => slide) }).success).toBe(false);
  });

  it('keeps the autoplay interval within 2–20 seconds', () => {
    expect(blockSchemas.carousel.safeParse({ slides: [slide], interval: 1 }).success).toBe(false);
    expect(blockSchemas.carousel.safeParse({ slides: [slide], interval: 21 }).success).toBe(false);
  });

  it('checks product swatches against the colour grammar', () => {
    expect(blockSchemas.carousel.safeParse({ mode: 'products', slides: [{ swatches: ['#1b1b1b', '#d4c3a3'] }] }).success).toBe(true);
    expect(blockSchemas.carousel.safeParse({ mode: 'products', slides: [{ swatches: ['red;background:url(x)'] }] }).success).toBe(false);
  });

  it('bounds cards-in-view per tier', () => {
    expect(blockSchemas.carousel.safeParse({ slides: [slide], perView: { base: 4, mobile: 1.2 } }).success).toBe(true);
    expect(blockSchemas.carousel.safeParse({ slides: [slide], perView: { base: 0 } }).success).toBe(false);
    expect(blockSchemas.carousel.safeParse({ slides: [slide], perView: { base: 7 } }).success).toBe(false);
  });

  it('rejects an unsafe slide link', () => {
    expect(blockSchemas.carousel.safeParse({ slides: [{ href: 'data:text/html,hi' }] }).success).toBe(false);
  });
});

describe('marquee and stacked panels', () => {
  it('allows one or two marquee rows only', () => {
    expect(blockSchemas.marquee.parse({ items: [{ label: 'A' }] }).rows).toBe(1);
    expect(blockSchemas.marquee.safeParse({ items: [{ label: 'A' }], rows: 3 }).success).toBe(false);
  });

  it('needs a title on every stacked panel', () => {
    expect(blockSchemas.stackedPanels.safeParse({ panels: [{ title: 'One' }] }).success).toBe(true);
    expect(blockSchemas.stackedPanels.safeParse({ panels: [{ body: 'No title' }] }).success).toBe(false);
  });

  it('survives the block tree parser', () => {
    const parsed = parseBlocks([
      { id: 'c1', type: 'carousel', props: { mode: 'hero', slides: [slide] } },
      { id: 'm1', type: 'marquee', props: { items: [{ label: 'A' }] } },
      { id: 's1', type: 'stackedPanels', props: { panels: [{ title: 'One' }] } },
    ]);
    expect(parsed.map((b) => b.type)).toEqual(['carousel', 'marquee', 'stackedPanels']);
  });
});
