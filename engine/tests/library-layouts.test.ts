import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';

/* Package 2 layouts, part two: stored blocks keep their old look, new options are checked. */

describe('new options default to the previous look', () => {
  it('carousel and marquee', () => {
    const slide = { title: 'A' };
    expect(blockSchemas.carousel.parse({ slides: [slide] })).toMatchObject({ mode: 'cards', direction: 'horizontal', indicator: 'dots' });
    expect(blockSchemas.marquee.parse({ items: [{ label: 'A' }] })).toMatchObject({ kind: 'logos', direction: 'left', separator: 'dot', hoverSlow: false });
  });

  it('quote, tabs, newsletter and contact form', () => {
    expect(blockSchemas.quote.parse({ quote: 'Q' })).toMatchObject({ avatarPosition: 'caption', avatarSize: 'medium' });
    expect(blockSchemas.tabs.parse({ tabs: [{ label: 'A' }] })).toMatchObject({ style: 'pill', orientation: 'horizontal', barPosition: 'below' });
    expect(blockSchemas.newsletter.parse({ title: 'T' })).toMatchObject({ layout: 'form', fieldStyle: 'standard' });
    expect(blockSchemas.contactForm.parse({}).layout).toBe('stacked');
  });

  it('post list', () => {
    expect(blockSchemas.postList.parse({})).toMatchObject({ variant: 'cards', pagination: 'none', perPage: 6 });
  });
});

describe('new options are checked', () => {
  it('keeps a page of posts between 1 and 24', () => {
    expect(blockSchemas.postList.safeParse({ perPage: 0 }).success).toBe(false);
    expect(blockSchemas.postList.safeParse({ perPage: 25 }).success).toBe(false);
    expect(blockSchemas.postList.safeParse({ pagination: 'infinite' }).success).toBe(false);
  });

  it('only accepts safe tab icons', () => {
    expect(blockSchemas.tabs.safeParse({ tabs: [{ label: 'A', iconUrl: 'javascript:alert(1)' }] }).success).toBe(false);
    expect(blockSchemas.tabs.safeParse({ tabs: [{ label: 'A', iconUrl: '/media/demo/app-icon.png' }] }).success).toBe(true);
  });

  it('accepts the new carousel mode and indicator', () => {
    expect(blockSchemas.carousel.safeParse({ mode: 'quotes', indicator: 'numbers', slides: [{ body: 'Q', title: 'N' }] }).success).toBe(true);
    expect(blockSchemas.carousel.safeParse({ direction: 'diagonal', slides: [{ title: 'A' }] }).success).toBe(false);
  });
});
