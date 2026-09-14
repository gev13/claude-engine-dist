import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';

/*
 * Package 2 added options to blocks that already had stored pages. Every one
 * defaults to the look the block had before, so a page saved last year parses
 * to exactly what it rendered then.
 */
describe('new layouts keep stored blocks as they were', () => {
  it('card grid', () => {
    expect(blockSchemas.cardGrid.parse({ cards: [{ title: 'A' }] })).toMatchObject({
      variant: 'cards',
      hover: 'none',
      shadow: false,
      offset: false,
      iconStyle: 'boxed',
      iconPosition: 'top',
    });
  });

  it('FAQ', () => {
    expect(blockSchemas.faq.parse({ items: [] })).toMatchObject({ variant: 'list', style: 'lines', icon: 'plus' });
  });

  it('stats, call to action and logo wall', () => {
    expect(blockSchemas.stats.parse({ items: [] })).toMatchObject({ variant: 'tiles', countUp: true, iconPosition: 'top' });
    expect(blockSchemas.cta.parse({ title: 'T' }).variant).toBe('band');
    expect(blockSchemas.logoWall.parse({ logos: [{ name: 'A' }] })).toMatchObject({ style: 'tiles', captions: false });
  });
});

describe('the new options are checked', () => {
  it('caps a row’s checklist at eight short points', () => {
    const card = (points: string[]) => ({ cards: [{ title: 'A', points }] });
    expect(blockSchemas.cardGrid.safeParse(card(Array.from({ length: 9 }, (_, i) => `Point ${i}`))).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse(card(['x'.repeat(121)])).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse(card(['Stakeholder interviews'])).success).toBe(true);
  });

  it('only accepts safe counter icons', () => {
    expect(blockSchemas.stats.safeParse({ variant: 'counters', items: [{ value: '1', label: 'A', iconUrl: 'javascript:alert(1)' }] }).success).toBe(false);
  });

  it('rejects styles it does not know', () => {
    expect(blockSchemas.faq.safeParse({ items: [], style: 'wavy' }).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse({ cards: [], iconPosition: 'bottom' }).success).toBe(false);
  });
});
