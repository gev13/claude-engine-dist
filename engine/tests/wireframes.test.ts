import { describe, expect, it } from 'vitest';
import { CARD_GRID_VARIANTS, CAROUSEL_MODES, HERO_VARIANTS, blockTypes } from '../src/lib/blocks';
import { BLOG_INDEX_LAYOUTS, BLOG_POST_LAYOUTS } from '../src/lib/blog';
import { FOOTER_VARIANTS, HEADER_VARIANTS, MEGA_VARIANTS, MOBILE_MENU_VARIANTS } from '../src/lib/chrome';
import {
  BLOCK_WIREFRAMES,
  BLOG_INDEX_WIREFRAMES,
  BLOG_POST_WIREFRAMES,
  type Wire,
  CARD_GRID_WIREFRAMES,
  CAROUSEL_WIREFRAMES,
  FOOTER_WIREFRAMES,
  HEADER_WIREFRAMES,
  HERO_WIREFRAMES,
  MEGA_WIREFRAMES,
  MOBILE_MENU_WIREFRAMES,
  SHAPE_KINDS,
  type Shape,
} from '../src/lib/wireframes';

function kinds(shapes: readonly Shape[]): string[] {
  return shapes.flatMap((s) => (s[0] === 'g' && Array.isArray(s[2]) ? ['g', ...kinds(s[2] as Shape[])] : [String(s[0])]));
}

describe('wireframes', () => {
  it('has a picture for every block type and every variant', () => {
    for (const type of blockTypes) expect(BLOCK_WIREFRAMES[type]?.length, type).toBeGreaterThan(0);
    for (const v of HERO_VARIANTS) expect(HERO_WIREFRAMES[v].length, v).toBeGreaterThan(0);
    for (const v of CAROUSEL_MODES) expect(CAROUSEL_WIREFRAMES[v].length, v).toBeGreaterThan(0);
    for (const v of CARD_GRID_VARIANTS) expect(CARD_GRID_WIREFRAMES[v].length, v).toBeGreaterThan(0);
    for (const v of HEADER_VARIANTS) expect(HEADER_WIREFRAMES[v].shapes.length, v).toBeGreaterThan(0);
    for (const v of MEGA_VARIANTS) expect(MEGA_WIREFRAMES[v].shapes.length, v).toBeGreaterThan(0);
    for (const v of MOBILE_MENU_VARIANTS) expect(MOBILE_MENU_WIREFRAMES[v].shapes.length, v).toBeGreaterThan(0);
    for (const v of FOOTER_VARIANTS) expect(FOOTER_WIREFRAMES[v].shapes.length, v).toBeGreaterThan(0);
    for (const v of BLOG_INDEX_LAYOUTS) expect(BLOG_INDEX_WIREFRAMES[v].shapes.length, v).toBeGreaterThan(0);
    for (const v of BLOG_POST_LAYOUTS) expect(BLOG_POST_WIREFRAMES[v].shapes.length, v).toBeGreaterThan(0);
  });

  it('uses only shapes the renderer knows', () => {
    const all = [
      ...Object.values(BLOCK_WIREFRAMES),
      ...Object.values(HERO_WIREFRAMES),
      ...Object.values(CAROUSEL_WIREFRAMES),
      ...Object.values(CARD_GRID_WIREFRAMES),
      ...[HEADER_WIREFRAMES, MEGA_WIREFRAMES, MOBILE_MENU_WIREFRAMES, FOOTER_WIREFRAMES, BLOG_INDEX_WIREFRAMES, BLOG_POST_WIREFRAMES].flatMap((m) =>
        Object.values<Wire>(m).map((w) => w.shapes),
      ),
    ];
    for (const shapes of all) {
      for (const kind of kinds(shapes)) expect(SHAPE_KINDS as readonly string[]).toContain(kind);
    }
  });
});
