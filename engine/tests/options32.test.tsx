import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card, CardGrid } from '@/components/ui/Card';
import { blockSchemas } from '@/lib/blocks';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.2 — three more options found building a site from a design: a form
   the full width of its section, the colours of every field, and the
   cover above each title in the plain post cards. Nothing until chosen. */

describe('a form, full width', () => {
  const form = { formName: 'Contact', fields: [{ id: 'name', type: 'text', label: 'Name' }] };
  it('keeps its reading width until told otherwise', () => {
    expect(blockSchemas.form.parse(form).wide).toBeUndefined();
    expect(blockSchemas.form.parse({ ...form, wide: true }).wide).toBe(true);
  });
});

describe('field colours', () => {
  it('write nothing until one is set', () => {
    expect(themeToCss(themeSchema.parse({}))).not.toContain('he-fb__choice input:not(:checked)');
  });

  it('colour the fields, and the chips only while unchosen', () => {
    const css = themeToCss(themeSchema.parse({ fields: { background: '#262626', border: 'transparent', text: '#f3f2f2' } }));
    expect(css).toMatch(/textarea\.he-fb__input[^{]*\{background-color:#262626;border-color:transparent;color:#f3f2f2\}/);
    expect(css).toContain('.he-fb__choice input:not(:checked)+span{background-color:#262626;border-color:transparent}');
  });

  it('take only colours', () => {
    expect(themeSchema.safeParse({ fields: { background: 'url(x)' } }).success).toBe(false);
  });
});

describe('covers on the plain post cards', () => {
  it('are off until chosen', () => {
    expect(blockSchemas.postList.parse({}).card).toBeUndefined();
    expect(blockSchemas.postList.parse({ card: { image: true, ratio: '3/2' } }).card).toMatchObject({ image: true, ratio: '3/2' });
  });

  it('draw the picture first in the card, and nothing without one', () => {
    const withMedia = renderToStaticMarkup(<Card title="T" media={<img src="/media/a.webp" alt="" />} />);
    expect(withMedia).toMatch(/<div class="he-ucard[^"]*"><div class="he-ucard__media"><img/);
    expect(renderToStaticMarkup(<Card title="T" />)).not.toContain('he-ucard__media');
  });

  it('hand the picture shape to the cards through the grid', () => {
    const html = renderToStaticMarkup(<CardGrid style={{ '--he-ucard-ratio': '3 / 2' } as React.CSSProperties}>x</CardGrid>);
    expect(html).toContain('--he-ucard-ratio:3 / 2');
    expect(renderToStaticMarkup(<CardGrid>x</CardGrid>)).not.toContain('style=');
  });
});
