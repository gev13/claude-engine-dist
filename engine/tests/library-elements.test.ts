import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';
import { splitDuration } from '../src/lib/countdown';

describe('heading (EL1)', () => {
  it('defaults to a large, left-aligned heading with no typed words', () => {
    expect(blockSchemas.heading.parse({ title: 'T' })).toMatchObject({ align: 'left', size: 'large', rotating: [], divider: 'none' });
  });

  it('needs a title and caps the typed words at eight', () => {
    expect(blockSchemas.heading.safeParse({ title: '' }).success).toBe(false);
    expect(blockSchemas.heading.safeParse({ title: 'T', rotating: Array.from({ length: 9 }, (_, i) => `w${i}`) }).success).toBe(false);
  });
});

describe('buttons (EL2)', () => {
  it('requires a label even for an icon-only button, and an icon for one', () => {
    expect(blockSchemas.buttons.safeParse({ items: [{ label: 'Add', href: '/', icon: 'plus', iconOnly: true }] }).success).toBe(true);
    expect(blockSchemas.buttons.safeParse({ items: [{ label: 'Add', href: '/', iconOnly: true }] }).success).toBe(false);
    expect(blockSchemas.buttons.safeParse({ items: [{ label: '', href: '/' }] }).success).toBe(false);
  });

  it('rejects unsafe links', () => {
    expect(blockSchemas.buttons.safeParse({ items: [{ label: 'Go', href: 'javascript:alert(1)' }] }).success).toBe(false);
  });
});

describe('notice, progress, countdown (EL3–EL5)', () => {
  it('defaults a notice to an information message with an icon', () => {
    expect(blockSchemas.notice.parse({ text: 'Hi' })).toMatchObject({ kind: 'info', icon: true, dismissible: false });
  });

  it('keeps progress values between 0 and 100', () => {
    expect(blockSchemas.progress.safeParse({ items: [{ label: 'A', value: 101 }] }).success).toBe(false);
    expect(blockSchemas.progress.safeParse({ items: [{ label: 'A', value: -1 }] }).success).toBe(false);
  });

  it('only accepts a countdown target that is a real date', () => {
    expect(blockSchemas.countdown.safeParse({ target: '2027-01-01T09:00:00.000Z' }).success).toBe(true);
    expect(blockSchemas.countdown.safeParse({ target: 'next tuesday' }).success).toBe(false);
  });

  it('splits a duration across the chosen units, largest first', () => {
    const ms = ((2 * 24 + 3) * 60 + 4) * 60_000 + 5000;
    expect(splitDuration(ms, ['days', 'hours', 'minutes', 'seconds'])).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    // Without days, they roll into hours.
    expect(splitDuration(ms, ['hours', 'minutes'])).toEqual({ hours: 51, minutes: 4 });
    expect(splitDuration(-5000, ['seconds'])).toEqual({ seconds: 0 });
  });
});

describe('social links, pricing, team (EL6–EL8)', () => {
  it('uses the site’s links by default and checks custom ones', () => {
    expect(blockSchemas.socialLinks.parse({}).source).toBe('site');
    expect(blockSchemas.socialLinks.safeParse({ source: 'custom', links: [{ network: 'myspace', href: 'https://x.test' }] }).success).toBe(false);
  });

  it('allows one to four plans, each with a name and a price', () => {
    const plan = { name: 'A', price: '$1' };
    expect(blockSchemas.pricing.safeParse({ plans: [] }).success).toBe(false);
    expect(blockSchemas.pricing.safeParse({ plans: Array.from({ length: 5 }, () => plan) }).success).toBe(false);
    expect(blockSchemas.pricing.safeParse({ plans: [{ name: 'A', price: '' }] }).success).toBe(false);
    expect(blockSchemas.pricing.parse({ plans: [plan] })).toMatchObject({ billing: 'single', layout: 'cards', buttonPosition: 'bottom' });
  });

  it('checks team photos and profile links', () => {
    expect(blockSchemas.team.safeParse({ members: [{ name: 'A', imageUrl: 'javascript:x' }] }).success).toBe(false);
    expect(blockSchemas.team.safeParse({ members: [{ name: 'A', links: [{ network: 'github', href: 'https://github.com/a' }] }] }).success).toBe(true);
  });
});
