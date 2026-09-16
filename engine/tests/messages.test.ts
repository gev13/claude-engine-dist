import { describe, expect, it } from 'vitest';
import { MESSAGES, MESSAGE_KEYS, mergeMessages, message } from '@/lib/messages';
import { localeKey, splitLocaleKey } from '@/server/content/localisedSettings';

/* ═══════════════════════════════════════════════════════════════════════════
   The engine's own words, and the keys they are stored under
   ───────────────────────────────────────────────────────────────────────────
   The rule that matters: anything missing falls through to English. A
   half-translated site should read as a site in two languages, never as one
   with blank labels or raw keys showing through.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the catalogue', () => {
  it('gives every key English text', () => {
    for (const key of MESSAGE_KEYS) {
      expect(MESSAGES[key], key).toBeTruthy();
      expect(typeof MESSAGES[key], key).toBe('string');
    }
    expect(MESSAGE_KEYS.length).toBeGreaterThan(30);
  });

  it('covers the chrome a visitor meets on every page', () => {
    for (const key of ['chrome.skipToContent', 'chrome.openMenu', 'chrome.search', 'chrome.backToTop'] as const) {
      expect(MESSAGE_KEYS, key).toContain(key);
    }
  });
});

describe('mergeMessages', () => {
  it('takes a translation where there is one', () => {
    const merged = mergeMessages({ 'chrome.skipToContent': 'Անցնել բովանդակությանը' });
    expect(merged['chrome.skipToContent']).toBe('Անցնել բովանդակությանը');
  });

  it('falls through to English for everything else', () => {
    const merged = mergeMessages({ 'chrome.skipToContent': 'Անցնել' });
    expect(merged['blog.minRead']).toBe(MESSAGES['blog.minRead']);
    // Every key still has something.
    for (const key of MESSAGE_KEYS) expect(merged[key], key).toBeTruthy();
  });

  it('ignores an empty translation rather than rendering a blank label', () => {
    expect(mergeMessages({ 'chrome.search': '   ' })['chrome.search']).toBe(MESSAGES['chrome.search']);
    expect(mergeMessages({ 'chrome.search': '' })['chrome.search']).toBe(MESSAGES['chrome.search']);
  });

  it('ignores a key the catalogue does not have', () => {
    const merged = mergeMessages({ 'not.a.key': 'whatever' });
    expect(merged['not.a.key']).toBeUndefined();
  });

  it('survives nonsense without taking the site down', () => {
    for (const rubbish of [null, undefined, 'a string', 42, []]) {
      const merged = mergeMessages(rubbish);
      expect(merged['chrome.search']).toBe(MESSAGES['chrome.search']);
    }
  });

  it('ignores a non-string value', () => {
    const merged = mergeMessages({ 'chrome.search': 42 });
    expect(merged['chrome.search']).toBe(MESSAGES['chrome.search']);
  });
});

describe('message()', () => {
  it('prefers the translation, then English, then the key', () => {
    expect(message({ 'chrome.search': 'Որոնել' }, 'chrome.search')).toBe('Որոնել');
    expect(message({}, 'chrome.search')).toBe(MESSAGES['chrome.search']);
    expect(message(undefined, 'chrome.search')).toBe(MESSAGES['chrome.search']);
  });
});

describe('localised settings keys', () => {
  it('leaves the main language unsuffixed', () => {
    // The original lives at the bare key; only translations are suffixed.
    expect(localeKey('navigation', 'en', 'en')).toBe('navigation');
    expect(localeKey('site.name', 'en', 'en')).toBe('site.name');
  });

  it('suffixes every other language', () => {
    expect(localeKey('navigation', 'hy', 'en')).toBe('navigation:hy');
    expect(localeKey('site.name', 'ru', 'en')).toBe('site.name:ru');
  });

  it('follows whichever language is the main one', () => {
    // With Armenian as the main language, English is the suffixed one.
    expect(localeKey('navigation', 'hy', 'hy')).toBe('navigation');
    expect(localeKey('navigation', 'en', 'hy')).toBe('navigation:en');
  });

  it('splits back into its parts', () => {
    expect(splitLocaleKey('navigation:hy')).toEqual({ key: 'navigation', locale: 'hy' });
    expect(splitLocaleKey('site.name:ru')).toEqual({ key: 'site.name', locale: 'ru' });
  });

  it('treats an unsuffixed key as having no language', () => {
    expect(splitLocaleKey('navigation')).toEqual({ key: 'navigation', locale: null });
    // A dotted key is not a suffixed one.
    expect(splitLocaleKey('engine.update.run')).toEqual({ key: 'engine.update.run', locale: null });
  });

  it('round-trips for every kind of key', () => {
    for (const key of ['navigation', 'popups', 'site.name', 'messages']) {
      expect(splitLocaleKey(localeKey(key, 'hy', 'en'))).toEqual({ key, locale: 'hy' });
    }
  });
});
