import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { fieldsReachContact } from '@/lib/fieldsCss';
import { formSpacing } from '@/lib/formSpacing';
import { infoPanelLook } from '@/lib/infoPanelLook';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.37 — forms: the info panel's rows, the form block's spacing under its
   heading and above the send button, and the theme's placeholder and text
   box options for every form the engine draws. Each off, and drawn as
   before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (key: string) => key }));
vi.mock('@/components/site/Captcha', () => ({ useChallenge: () => ({ field: null, token: async () => '', reset: () => {} }) }));

const { InfoPanelBlock } = await import('@/components/blocks');
const { FormBlock } = await import('@/components/blocks/library/FormBlock');
const { ContactFormClient } = await import('@/components/blocks/ContactFormBlock');

const css = readFileSync(new URL('../src/styles/library-form-details.css', import.meta.url), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

const items = [{ label: 'Phone', value: '+1 000', icon: 'phone' }, { label: 'Mail', value: 'a@b.c', icon: 'mail' }];
const panel = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<InfoPanelBlock {...(blockSchemas.infoPanel.parse({ layout: 'list', items, ...extra }) as Parameters<typeof InfoPanelBlock>[0])} />);

const formBase = { formName: 'Contact', title: 'Write to us', fields: [{ id: 'msg', type: 'textarea', label: 'Message' }] };
const form = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<FormBlock {...(blockSchemas.form.parse({ ...formBase, ...extra }) as unknown as Parameters<typeof FormBlock>[0])} />);

describe('the info panel’s rows', () => {
  it('render exactly as before with nothing set', () => {
    const out = panel();
    expect(out).toContain('<dl class="he-info"><div class="he-info__row">');
    expect(out).not.toContain('--he-info');
    expect(infoPanelLook({})).toEqual({ classes: [], style: undefined });
  });
  it('carry a class and a custom property per option', () => {
    const out = panel({ iconTile: 'transparent', iconColor: '#123456', iconGlyph: '24px', iconStroke: 1.5, labelGap: '12px', rowGap: '48px', rowGapMobile: '32px', rowAlign: 'center' });
    expect(out).toContain('class="he-info has-tile has-icon-color has-glyph has-stroke has-label-gap has-row-gap has-row-gap-m is-row-center"');
    expect(out).toContain('--he-info-tile:transparent;--he-info-icon:#123456;--he-info-glyph:24px;--he-info-stroke:1.5;--he-info-lgap:12px;--he-info-gap:48px;--he-info-gap-m:32px');
  });
  it('write the label’s and the value’s type through the shared type style', () => {
    const { classes, style } = infoPanelLook({ labelType: { size: '16px', weight: '500', tracking: '-0.3px', color: 'rgba(0,0,0,.5)' }, valueType: { line: '1.2', sizeMobile: '14px' } });
    expect(classes).toEqual(['has-label-type', 'has-value-type']);
    expect(style).toEqual({ '--he-info-l-size': '16px', '--he-info-l-weight': '500', '--he-info-l-tracking': '-0.3px', '--he-info-l-color': 'rgba(0,0,0,.5)', '--he-info-v-line': '1.2', '--he-info-v-size-m': '14px' });
    expect(css).toContain('.he-info.has-label-type .he-info__label { font-family: var(--he-info-l-font, revert-layer)');
  });
  it('shape the tile with the corner shapes: a leaf’s radii, a cut’s clip, and the phone sizes apart', () => {
    expect(infoPanelLook({ iconCorners: { style: 'leaf', size: 12 } }).style).toEqual({ '--he-info-clip': 'none', '--he-info-radius': '0px 12px 0px 12px' });
    const cut = infoPanelLook({ iconCorners: { style: 'cut', size: 6, corners: ['tl'] } });
    expect(cut.style!['--he-info-clip']).toBe('polygon(6px 0,calc(100% - 0px) 0,100% 0px,100% calc(100% - 0px),calc(100% - 0px) 100%,0px 100%,0 calc(100% - 0px),0 6px)');
    expect(cut.style!['--he-info-radius']).toBe('0px');
    const phone = infoPanelLook({ iconCorners: { style: 'leaf', size: 12, sizeMobile: 8 } });
    expect(phone.classes).toEqual(['has-tile-shape', 'has-tile-shape-m']);
    expect(phone.style!['--he-info-radius-m']).toBe('0px 8px 0px 8px');
    // Rounded keeps the tile's own radius.
    expect(infoPanelLook({ iconCorners: { style: 'rounded', size: 12 } })).toEqual({ classes: [], style: undefined });
  });
  it('mean nothing on the grid layout', () => {
    const out = renderToStaticMarkup(<InfoPanelBlock {...(blockSchemas.infoPanel.parse({ items, rowGap: '48px' }) as Parameters<typeof InfoPanelBlock>[0])} />);
    expect(out).not.toContain('he-info');
    expect(out).not.toContain('48px');
  });
  it('refuse a value that could leave the style', () => {
    for (const bad of [{ rowGap: '12px;}' }, { iconTile: 'red;}' }, { iconGlyph: 'url(x)' }, { labelGap: '12' }, { iconStroke: 9 }, { rowAlign: 'end' }, { labelType: { color: '#fff;}' } }, { iconCorners: { style: 'leaf', size: 999 } }]) {
      expect(blockSchemas.infoPanel.safeParse({ layout: 'list', items, ...bad }).success).toBe(false);
    }
    // And again where it is written.
    expect(infoPanelLook({ rowGap: '12px;}', iconTile: 'red;}' } as never)).toEqual({ classes: [], style: undefined });
  });
  it('are styled only through the classes the options write', () => {
    const selectors = css.match(/\.he-info[^{]*\{/g) ?? [];
    expect(selectors.length).toBeGreaterThan(10);
    for (const s of selectors) expect(s).toMatch(/\.he-info\.(has-|is-row-center)/);
  });
});

describe('the form block’s spacing', () => {
  it('renders exactly as before with nothing set', () => {
    const out = form();
    expect(out).toContain('<section class="he-lsec he-fb is-card"><div class="shell"><div class="he-head mb-9">');
    expect(formSpacing({})).toEqual({ classes: [], style: {} });
  });
  it('sets the space under the heading and above the send button, and on phones', () => {
    const out = form({ titleGap: '40px', titleGapMobile: '32px', submitGap: '40px', submitGapMobile: '24px' });
    expect(out).toContain('<section class="he-lsec he-fb is-card has-title-gap has-title-gap-m has-submit-gap has-submit-gap-m" style="--he-fb-tgap:40px;--he-fb-tgap-m:32px;--he-fb-sgap:40px;--he-fb-sgap-m:24px">');
    expect(css).toContain('.he-fb.has-title-gap .he-head + .he-fb__box { margin-top: var(--he-fb-tgap); }');
    expect(css).toContain('.he-fb.has-submit-gap .he-fb__actions { margin-top: var(--he-fb-sgap); }');
  });
  it('keeps the other options’ custom properties beside its own', () => {
    expect(form({ fieldGap: '10px', submitGap: '40px' })).toContain('style="--he-fb-gap:10px;--he-fb-sgap:40px"');
  });
  it('refuses a value that could leave the style', () => {
    for (const bad of ['40px;}', 'red', '40']) expect(blockSchemas.form.safeParse({ ...formBase, submitGap: bad }).success).toBe(false);
    expect(formSpacing({ titleGap: '1px;}' })).toEqual({ classes: [], style: {} });
  });
});

describe('the theme’s placeholder and text box', () => {
  const before = { fields: { background: '#123456', radius: '12px', textareaHeight: '160px' } };
  it('write nothing unset', () => {
    const out = theme(before);
    expect(out).not.toContain('::placeholder');
    expect(out).not.toContain('he-cf__input');
    expect(out).not.toContain('resize');
    expect(theme({})).toBe('');
    expect(fieldsReachContact(themeSchema.parse(before).fields)).toBe(false);
  });
  it('colour and space every form’s placeholder, the drop-down’s “Choose…” too', () => {
    const out = theme({ fields: { placeholder: 'rgba(0,0,0,.2)', placeholderTracking: '-0.3px' } });
    expect(out).toContain(':is(input.he-fb__input,textarea.he-fb__input,.he-nl__input,.he-srch__input,.he-field,.he-cf__input)::placeholder{color:rgba(0,0,0,.2);letter-spacing:-0.3px}');
    expect(out).toContain('.he-fb__multival.is-empty{color:rgba(0,0,0,.2);letter-spacing:-0.3px}');
  });
  it('give a text box its own corners, top padding and grip, after the fields’ corners', () => {
    const out = theme({ fields: { radius: '30px', textareaRadius: '24px', textareaPaddingTop: '16px', textareaResize: 'none' } });
    const rule = 'textarea:is(.he-fb__input,.he-cf__input):not([type=file]){border-radius:24px;padding-top:16px;resize:none}';
    expect(out).toContain(rule);
    expect(out.indexOf(rule)).toBeGreaterThan(out.indexOf('border-radius:30px'));
  });
  it('reach the admin preview under its scope', () => {
    const out = themeToCss(themeSchema.parse({ fields: { placeholder: '#123456' } }), { selector: '.he-preview' });
    expect(out).toContain('.he-preview :is(input.he-fb__input');
  });
  it('mark the contact form’s fields only while one is set', () => {
    const props = blockSchemas.contactForm.parse({});
    const plain = renderToStaticMarkup(<ContactFormClient {...props} serviceOptions={[]} />);
    expect(plain).not.toContain('he-cf__input');
    const marked = renderToStaticMarkup(<ContactFormClient {...props} serviceOptions={[]} themedFields />);
    expect(marked.match(/he-cf__input/g)?.length).toBe(6);
    expect(marked).toMatch(/<textarea[^>]*class="[^"]*he-cf__input resize-y"/);
    expect(fieldsReachContact(themeSchema.parse({ fields: { textareaResize: 'vertical' } }).fields)).toBe(true);
  });
  it('refuse a value that could leave the style', () => {
    for (const bad of [{ placeholder: 'red;}' }, { placeholderTracking: '1px;}' }, { textareaRadius: 'url(x)' }, { textareaPaddingTop: '1px}' }, { textareaResize: 'both' }]) {
      expect(themeSchema.safeParse({ fields: bad }).success).toBe(false);
    }
  });
});
