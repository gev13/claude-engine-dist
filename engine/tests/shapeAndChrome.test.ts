import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { blockStyleSchema } from '@/lib/blockStyle';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { FONT_CATALOGUE } from '@/lib/fontCatalogue';
import { itemStyleToCss } from '@/lib/itemStyle';
import { CUT_BUTTON_BACKGROUND, cutLegs, cutLines, cutPolygon } from '@/lib/shape';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 2.21 — cut corners, panels, the notch header, button extras, the eyebrow
   marker, header link type, a side-fading band and Chakra Petch. Each is
   nothing until chosen. */

const css = (theme: unknown) => themeToCss(themeSchema.parse(theme));

describe('cut corners', () => {
  it('cut the top right and bottom left unless told otherwise, within bounds', () => {
    expect(cutLegs(undefined, 20)).toBeNull();
    expect(cutLegs({ style: 'rounded' }, 20)).toBeNull();
    expect(cutLegs({ style: 'cut' }, 20)).toEqual({ tl: 0, tr: 20, br: 0, bl: 20 });
    expect(cutLegs({ style: 'cut', size: 8, corners: ['tl', 'br'] }, 20)).toEqual({ tl: 8, tr: 0, br: 8, bl: 0 });
    expect(cutPolygon({ tl: 0, tr: 999, br: 0, bl: -5 })).toContain('calc(100% - 96px) 0');
    expect(cutPolygon({ tl: 0, tr: 10, br: 0, bl: 10 })).toBe('polygon(0px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 0px),calc(100% - 0px) 100%,10px 100%,0 calc(100% - 10px),0 0px)');
  });

  it('draw a line only along the corners that are cut', () => {
    const lines = cutLines({ tl: 0, tr: 6, br: 0, bl: 6 })!;
    expect(lines.image.match(/linear-gradient/g)).toHaveLength(2);
    expect(lines.position).toBe('top right,bottom left');
    expect(lines.size).toBe('6px 6px,6px 6px');
    expect(cutLines({ tl: 0, tr: 0, br: 0, bl: 0 })).toBeNull();
  });

  it('are refused past their bounds', () => {
    expect(themeSchema.safeParse({ shape: { cards: { style: 'cut', size: 500 } } }).success).toBe(false);
    expect(themeSchema.safeParse({ shape: { chips: { style: 'cut', corners: [] } } }).success).toBe(false);
  });
});

describe('an untouched theme', () => {
  it('writes none of the new rules', () => {
    const out = css({});
    for (const token of ['--he-card-clip', '--he-image-clip', 'clip-path', '--he-bf', 'drop-shadow', '--he-btn-font', 'he-eyebrow__rule', '--he-panel', '--he-nav-']) {
      expect(out, token).not.toContain(token);
    }
  });
});

describe('the theme’s shapes', () => {
  it('clip every card through one variable, and take their radius away', () => {
    const out = css({ shape: { cards: { style: 'cut', size: 20 } } });
    expect(out).toContain('--he-card-radius:0px');
    expect(out).toMatch(/--he-card-clip:polygon\(0px 0,calc\(100% - 20px\) 0/);
  });

  it('paint buttons, so a glow follows the cut', () => {
    const out = css({ shape: { buttons: { style: 'cut' } }, buttons: { glow: { size: 18, color: '#17bde7' } } });
    expect(out).toContain(`background:${CUT_BUTTON_BACKGROUND}`);
    expect(out).toContain('--he-cut-tr:10px');
    expect(out).toContain('.he-btn-primary,.he-cbtn.is-primary{--he-bf:var(--he-btn-primary-bg)');
    expect(out).toContain('.he-btn-primary:hover,.he-cbtn.is-primary:hover{--he-bf:var(--he-btn-primary-hover-bg)');
    expect(out).toContain('filter:drop-shadow(0 0 18px #17bde7)');
  });

  it('clip chips and fields, keeping their border along the cut', () => {
    const out = css({ shape: { chips: { style: 'cut' }, inputs: { style: 'cut' } } });
    expect(out).toMatch(/:is\(\.he-fb__choice>span,\.he-proj__chip,\.he-chip\)\{clip-path:polygon/);
    expect(out).toMatch(/textarea\.he-fb__input[^{]*\{clip-path:polygon[^}]*background-image:linear-gradient[^;]*;background-position:top right,bottom left;background-size:8px 8px,8px 8px;background-repeat:no-repeat/);
    expect(out).toContain('outline-offset:-4px');
  });

  it('reach every card rule in the stylesheets', () => {
    const dir = path.join(process.cwd(), 'src/styles');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
      const text = readFileSync(path.join(dir, file), 'utf8');
      for (const match of text.matchAll(/border-radius:[^;{}]*var\(--he-card-radius\)[^;{}]*;([^;{}]*;)?/g)) {
        expect(match[0], `${file}: a card rule without the card clip`).toContain('clip-path: var(--he-card-clip, none)');
      }
    }
  });
});

describe('button extras, the eyebrow marker and header links', () => {
  it('set the button face and put the arrow in its own cell', () => {
    const out = css({ buttons: { font: 'chakraPetch', icon: 'cell' } });
    expect(out).toContain("--he-btn-font:'Chakra Petch'");
    expect(out).toContain('.he-btn>svg:last-child,.he-cbtn:not(.is-text):not(.is-icon-only)>svg:last-child:not(:first-child){box-sizing:content-box');
  });

  it('turn the rule into a dot, or leave it out', () => {
    expect(css({ eyebrow: { marker: 'dot', markerColor: '#17bde7' } })).toMatch(/\.he-eyebrow__rule\{width:6px;height:6px;border-radius:50%/);
    expect(css({ eyebrow: { marker: 'none' } })).toContain('.he-eyebrow__rule{display:none}');
  });

  it('set the header links', () => {
    const out = css({ nav: { font: 'jetbrainsMono', size: '11px', letterSpacing: '1.5px', gap: '32px', activeColor: '#8bdef3' } });
    expect(out).toContain('--he-nav-gap:32px');
    expect(out).toContain('--he-nav-active:#8bdef3');
  });
});

describe('panels and a block’s own corners', () => {
  it('set a section on the page as a panel, and let a hand-set margin win', () => {
    const out = blockStyleToCss('p1', blockStyleSchema.parse({ panel: true, spacing: { base: { marginTop: '0px' } } }));
    expect(out).toMatch(/^\.he-b-p1\{margin-inline:min\(var\(--he-panel-inset,24px\),3vw\);margin-block:min\(var\(--he-panel-gap,24px\),3vw\);background-color:var\(--he-panel-bg,var\(--color-surface\)\);clip-path:var\(--he-panel-clip,none\);margin-top:0px/);
    expect(out).toContain('.he-b-p1>*{background:transparent}');
    expect(out).toContain('.he-b-p1>*{border-bottom-width:0}');
  });

  it('cut or clip a block', () => {
    expect(blockStyleToCss('c1', blockStyleSchema.parse({ corners: { style: 'cut', size: 32 } }))).toContain('clip-path:polygon(0px 0,calc(100% - 32px) 0');
    expect(blockStyleToCss('c2', blockStyleSchema.parse({ clip: true, border: { radius: '16px' } }))).toContain('overflow:hidden');
  });

  it('take a catalogue face in a section’s typography', () => {
    expect(blockStyleSchema.safeParse({ typography: { heading: { family: 'chakraPetch' } } }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ typography: { heading: { family: 'comicSans' } } }).success).toBe(false);
  });

  it('cut one card', () => {
    expect(itemStyleToCss('.he-i-x-0', { corners: { style: 'cut' } })).toContain('clip-path:polygon(0px 0,calc(100% - 20px) 0');
  });

  it('write the panel settings as variables', () => {
    const out = css({ panel: { inset: '24px', background: '#141414', shape: { style: 'cut', size: 32 } } });
    expect(out).toContain('--he-panel-inset:24px');
    expect(out).toContain('--he-panel-bg:#141414');
    expect(out).toMatch(/--he-panel-clip:polygon\(0px 0,calc\(100% - 32px\) 0/);
  });
});

describe('the notch header', () => {
  it('neither sticks nor lies over a hero', () => {
    const chrome = resolveChrome(chromeSchema.parse({ header: { variant: 'notch', sticky: true, overlay: true } }));
    expect(chrome.header).toMatchObject({ variant: 'notch', sticky: false, overlay: false, notchRadius: 32 });
    expect(chromeSchema.safeParse({ header: { notchBackground: 'red;x' } }).success).toBe(false);
  });
});

describe('the media band’s side fade', () => {
  it('is nothing until chosen, and a colour when it is', () => {
    expect(blockSchemas.mediaBand.parse({}).fade).toBeUndefined();
    expect(blockSchemas.mediaBand.parse({ fade: { color: '#17bde7' } }).fade).toEqual({ side: 'left', color: '#17bde7', solid: 42, clear: 72, text: 'light' });
    expect(blockSchemas.mediaBand.safeParse({ fade: { color: 'url(x)' } }).success).toBe(false);
  });
});

describe('Chakra Petch', () => {
  it('is in the catalogue, with its in-between weights', () => {
    expect(FONT_CATALOGUE.find((font) => font.family === 'Chakra Petch')).toMatchObject({ key: 'chakraPetch', role: 'display' });
    const faces = readFileSync(path.join(process.cwd(), 'src/styles/fonts-google.css'), 'utf8');
    for (const weight of [400, 500, 600, 700]) expect(faces).toContain(`chakra-petch-normal-${weight}-latin.woff2`);
  });
});
