import { describe, expect, it } from 'vitest';
import { demoPopups } from '../src/content/demo/popups';
import { type AnyBlock, collectInvalidBlocks } from '../src/lib/blocks';
import { dueAgain, matchesPath, popupOnPage, popupSchema, popupsSchema } from '../src/lib/popups';

describe('demo popups', () => {
  it('pass the schema, with every block in them complete', () => {
    expect(popupsSchema.safeParse(demoPopups).success).toBe(true);
    for (const popup of demoPopups) expect(collectInvalidBlocks(popup.blocks as unknown as AnyBlock[]), popup.name).toEqual([]);
  });

  it('only open by themselves on the effects page', () => {
    for (const popup of demoPopups.filter((p) => p.trigger !== 'click')) {
      expect(popup.pages, popup.name).toBe('only');
      expect(popup.paths, popup.name).toEqual(['/library/effects']);
    }
  });
});

const base = { id: 'p1', name: 'Newsletter', slug: 'newsletter' };

describe('popup settings', () => {
  it('opens centred, after five seconds, once a session, on every page by default', () => {
    expect(popupSchema.parse(base)).toMatchObject({ position: 'center', trigger: 'delay', delay: 5, frequency: 'session', pages: 'all', enabled: true });
  });

  it('keeps link names and paths to safe grammars', () => {
    expect(popupSchema.safeParse({ ...base, slug: 'Sign Up!' }).success).toBe(false);
    expect(popupSchema.safeParse({ ...base, pages: 'only', paths: ['/blog/*', '/pricing'] }).success).toBe(true);
    expect(popupSchema.safeParse({ ...base, paths: ['javascript:alert(1)'] }).success).toBe(false);
    expect(popupSchema.safeParse({ ...base, paths: ['/a*b'] }).success).toBe(false);
  });

  it('refuses two popups with the same id or link name', () => {
    expect(popupsSchema.safeParse([base, { ...base, id: 'p2' }]).success).toBe(false);
    expect(popupsSchema.safeParse([base, { ...base, slug: 'other' }]).success).toBe(false);
    expect(popupsSchema.safeParse([base, { ...base, id: 'p2', slug: 'other' }]).success).toBe(true);
  });
});

describe('which pages a popup is for', () => {
  it('matches one page, or a page and everything under it', () => {
    expect(matchesPath('/pricing', '/pricing')).toBe(true);
    expect(matchesPath('/pricing', '/pricing/')).toBe(true);
    expect(matchesPath('/pricing', '/pricing/team')).toBe(false);
    expect(matchesPath('/blog/*', '/blog')).toBe(true);
    expect(matchesPath('/blog/*', '/blog/a-post')).toBe(true);
    expect(matchesPath('/blog/*', '/blogroll')).toBe(false);
    expect(matchesPath('/*', '/anything')).toBe(true);
  });

  it('shows only on, or everywhere except, the listed pages', () => {
    expect(popupOnPage({ pages: 'only', paths: ['/blog/*'] }, '/blog/x')).toBe(true);
    expect(popupOnPage({ pages: 'only', paths: ['/blog/*'] }, '/about')).toBe(false);
    expect(popupOnPage({ pages: 'except', paths: ['/contact'] }, '/contact')).toBe(false);
    expect(popupOnPage({ pages: 'all', paths: [] }, '/anywhere')).toBe(true);
  });
});

describe('how often a popup opens by itself', () => {
  const now = Date.UTC(2026, 8, 11);
  const day = 86_400_000;

  it('opens every time, once a session, or again after a number of days', () => {
    expect(dueAgain('always', 7, now - 1000, now)).toBe(true);
    expect(dueAgain('session', 7, null, now)).toBe(true);
    expect(dueAgain('session', 7, now - 1000, now)).toBe(false);
    expect(dueAgain('days', 7, now - 8 * day, now)).toBe(true);
    expect(dueAgain('days', 7, now - 1 * day, now)).toBe(false);
  });
});
