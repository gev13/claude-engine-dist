import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';

/* 3.0 — glitch text on a block's heading: noise, psycho and split. Nothing
   until chosen; the colours are the block's to set; a screen reader hears
   the heading once; nothing moves for less motion. */

const parse = (input: unknown) => blockStyleSchema.parse(input);
const sheet = readFileSync(join(__dirname, '../src/styles/library-glitch.css'), 'utf8');

describe('the glitch option', () => {
  it('is nothing until chosen', () => {
    expect(parse({}).glitch).toBeUndefined();
    expect(blockStyleToCss('b1', parse({ glitch: { effect: 'noise' } }))).not.toContain('--he-glitch');
  });

  it('takes the three effects and nothing else', () => {
    for (const effect of ['noise', 'psycho', 'split']) expect(blockStyleSchema.safeParse({ glitch: { effect } }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ glitch: { effect: 'melt' } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ glitch: { effect: 'noise', scope: 'paragraphs' } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ glitch: { effect: 'noise', trigger: 'hover', scope: 'headings' } }).success).toBe(true);
  });

  it('writes its colours as inherited properties, and only colours', () => {
    const css = blockStyleToCss('b1', parse({ glitch: { effect: 'split', colorA: '#ff0', colorB: '#0ff', background: '#101010' } }));
    expect(css).toContain('--he-glitch-a:#ff0');
    expect(css).toContain('--he-glitch-b:#0ff');
    expect(css).toContain('--he-glitch-bg:#101010');
    expect(blockStyleSchema.safeParse({ glitch: { effect: 'split', colorA: 'red;}body{' } }).success).toBe(false);
  });
});

describe('the stylesheet', () => {
  const rules = sheet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');

  it('styles nothing but headings the observer armed', () => {
    const selectors = [...rules.matchAll(/(@?[^{}]+)\{/g)].map((m) => m[1]!.trim()).filter((s) => s && !s.startsWith('@'));
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) expect(selector).toMatch(/he-glitch-(t|live)/);
  });

  it('gives the copies empty alternative text, so the heading is read once', () => {
    expect(sheet).toContain('content: attr(data-glitch-text) / "";');
  });

  it('stills everything for less motion, asked of the system or of the site', () => {
    expect(sheet).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?display: none/);
    expect(sheet).toMatch(/\.he-reduce-motion \.he-glitch-t::before/);
  });

  it('scales every duration by the block’s motion', () => {
    const animations = [...sheet.matchAll(/animation: (he-glitch[^;]+);/g)].map((m) => m[1]!);
    expect(animations.length).toBe(7);
    for (const animation of animations) expect(animation).toMatch(/calc\([\d.]+s \* var\(--he-motion, 1\)\)/);
  });
});
