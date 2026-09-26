import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.9 — a split hero's text centred in its whole panel under a notch header,
   its paragraphs' own width, a plain kicker, and a button's arrow in a
   colour of its own. All off until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const hero = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'h', type: 'hero', props: { variant: 'split', title: 'Hi', kicker: 'Services / 01', lede: 'L', imageUrl: '/media/x.webp', alt: '', ...props } }] as never} />);
const css = readFileSync(join(__dirname, '../src/styles/library-blocks.css'), 'utf8');

describe('a split hero', () => {
  it('adds nothing until chosen', () => {
    const html = hero({ bleed: true });
    for (const cls of ['is-centre-panel', 'is-kicker-plain', 'has-text-width']) expect(html).not.toContain(cls);
  });

  it('centres its text in the whole panel on wide screens', () => {
    expect(hero({ bleed: true, bleedCentre: 'panel' })).toContain('is-centre-panel');
    expect(hero({ bleedCentre: 'panel' })).not.toContain('is-centre-panel');
    expect(css).toMatch(/@media \(width > 48rem\) \{\s*\.he-hero--split\.is-bleed\.is-centre-panel \{ margin-top: calc\(-1 \* var\(--he-ns-now, 0px\)\); \}/);
  });

  it('sets its paragraphs’ width and a plain kicker', () => {
    const html = hero({ textWidth: '580px', kickerStyle: 'plain' });
    expect(html).toContain('has-text-width');
    expect(html).toContain('--he-hero-text:580px');
    expect(html).toContain('is-kicker-plain');
    expect(css).toContain('.he-hero.has-text-width :is(.he-hero__lede, .he-hero__body) { max-width: var(--he-hero-text); }');
  });
});

describe('a button’s arrow colour', () => {
  it('is the label’s until chosen', () => {
    expect(themeToCss(themeSchema.parse({ buttons: { ghost: { text: '#ffffff' } } }))).not.toContain('--he-btn-ghost-arrow');
  });

  it('can differ from the label', () => {
    const out = themeToCss(themeSchema.parse({ buttons: { ghost: { arrow: '#1e90ff' } } }));
    expect(out).toContain('--he-btn-ghost-arrow:#1e90ff');
    expect(out).toMatch(/\.he-btn-ghost>svg:last-child\{color:var\(--he-btn-ghost-arrow\)\}/);
  });
});
