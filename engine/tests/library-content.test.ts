import { describe, expect, it } from 'vitest';
import { blockSchemas, parseBlocks } from '../src/lib/blocks';

describe('variants on existing blocks keep stored pages valid', () => {
  it('parses an old card grid, stats band, faq, post list and image as before', () => {
    expect(blockSchemas.cardGrid.parse({ cards: [{ title: 'A' }] }).variant).toBe('cards');
    expect(blockSchemas.stats.parse({ items: [{ value: '1', label: 'x' }] }).variant).toBe('tiles');
    expect(blockSchemas.faq.parse({ items: [{ question: 'q', answer: 'a' }] }).variant).toBe('list');
    const list = blockSchemas.postList.parse({});
    expect(list).toMatchObject({ variant: 'cards', columns: 3 });
    expect(blockSchemas.image.parse({ url: '/media/a.jpg' }).captionStyle).toBe('mono');
  });

  it('checks the new media fields with the image-URL grammar', () => {
    expect(blockSchemas.cardGrid.safeParse({ variant: 'tiles', cards: [{ title: 'A', imageUrl: 'javascript:x' }] }).success).toBe(false);
    expect(blockSchemas.faq.safeParse({ variant: 'media', items: [{ question: 'q', answer: 'a', imageUrl: '/media/a.jpg' }] }).success).toBe(true);
  });
});

describe('content blocks', () => {
  it('fills defaults for split media and media band', () => {
    expect(blockSchemas.splitMedia.parse({ title: 'T' })).toMatchObject({ mediaSide: 'left', shape: 'rounded', ratio: 'portrait', links: [] });
    expect(blockSchemas.mediaBand.parse({ title: 'T' })).toMatchObject({ position: 'bottomLeft', height: 'tall', overlay: 'medium' });
  });

  it('caps buttons at two and rejects unsafe links', () => {
    const three = Array.from({ length: 3 }, () => ({ label: 'Go', href: '/' }));
    expect(blockSchemas.splitMedia.safeParse({ title: 'T', links: three }).success).toBe(false);
    expect(blockSchemas.mediaBand.safeParse({ title: 'T', links: [{ label: 'Go', href: 'javascript:alert(1)' }] }).success).toBe(false);
  });

  it('needs one to eight tabs, each with a label', () => {
    expect(blockSchemas.tabs.safeParse({ tabs: [] }).success).toBe(false);
    expect(blockSchemas.tabs.safeParse({ tabs: [{ label: '' }] }).success).toBe(false);
    expect(blockSchemas.tabs.safeParse({ tabs: Array.from({ length: 9 }, (_, i) => ({ label: `T${i}` })) }).success).toBe(false);
    expect(blockSchemas.tabs.parse({ tabs: [{ label: 'One' }] }).barPosition).toBe('below');
  });

  it('allows 3–6 logos per row only', () => {
    expect(blockSchemas.logoWall.safeParse({ logos: [{ name: 'A' }], columns: 2 }).success).toBe(false);
    expect(blockSchemas.logoWall.parse({ logos: [{ name: 'A' }] })).toMatchObject({ columns: 6, framed: false, align: 'center' });
  });

  it('validates swatch colours before they reach a style attribute', () => {
    expect(blockSchemas.configurator.safeParse({ options: [{ name: 'Red', color: '#c00' }] }).success).toBe(true);
    expect(blockSchemas.configurator.safeParse({ options: [{ name: 'Bad', color: 'red;background:url(x)' }] }).success).toBe(false);
  });

  it('keeps store links to the safe-href grammar', () => {
    expect(blockSchemas.appPromo.safeParse({ title: 'T', appStoreHref: 'https://apps.example.com/app' }).success).toBe(true);
    expect(blockSchemas.appPromo.safeParse({ title: 'T', playStoreHref: 'data:text/html,x' }).success).toBe(false);
    expect(blockSchemas.appPromo.safeParse({ title: 'T', screens: Array.from({ length: 4 }, () => ({ imageUrl: '/a.png' })) }).success).toBe(false);
  });

  it('holds code as plain text with a size limit', () => {
    expect(blockSchemas.windowFrame.parse({ tabs: [{ label: 'A', code: '<script>alert(1)</script>' }] }).tabs[0]?.code).toBe('<script>alert(1)</script>');
    expect(blockSchemas.windowFrame.safeParse({ tabs: [{ label: 'A', code: 'x'.repeat(6001) }] }).success).toBe(false);
  });

  it('needs a name and at least one link on the sub-nav', () => {
    expect(blockSchemas.subNav.safeParse({ name: 'P', links: [] }).success).toBe(false);
    expect(blockSchemas.subNav.safeParse({ name: '', links: [{ label: 'A', href: '#a' }] }).success).toBe(false);
    expect(blockSchemas.subNav.safeParse({ name: 'P', links: [{ label: 'A', href: '#overview' }] }).success).toBe(true);
  });

  it('survives the block tree parser', () => {
    const parsed = parseBlocks([
      { id: 'a', type: 'splitMedia', props: { title: 'T' } },
      { id: 'b', type: 'overlayCard', props: { title: 'T' } },
      { id: 'c', type: 'quote', props: { quote: 'Q' } },
      { id: 'd', type: 'collage', props: {} },
      { id: 'e', type: 'subNav', props: { name: 'P', links: [{ label: 'A', href: '/' }] } },
    ]);
    expect(parsed.map((b) => b.type)).toEqual(['splitMedia', 'overlayCard', 'quote', 'collage', 'subNav']);
  });
});
