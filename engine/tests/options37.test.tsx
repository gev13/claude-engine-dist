import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { resolveBlog } from '@/lib/blog';
import { itemStyleSchema, itemStyleToCss } from '@/lib/itemStyle';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.7 — a card's text set further in than its picture, words after a card's
   title in their own colour, the buttons' arrow pointing up and right,
   "Read more" as words alone, and the blog switched off. All opt-in. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);
const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('an image card’s text inset', () => {
  it('writes nothing until set, then a variable its text reads', () => {
    expect(itemStyleToCss('.c', itemStyleSchema.parse({ background: '#111' }))).not.toContain('--he-item-text-inset');
    expect(itemStyleToCss('.c', itemStyleSchema.parse({ textInset: '24px' }))).toContain('--he-item-text-inset:24px');
    expect(itemStyleSchema.safeParse({ textInset: 'wide' }).success).toBe(false);
    expect(read('src/styles/library-content.css')).toContain('padding-inline: var(--he-item-text-inset, 0);');
  });
});

describe('words after a card’s title', () => {
  const card = { title: 'Northwind', body: 'b', imageUrl: '/media/x.webp', alt: '' };
  it('are nothing until given, then follow the title in their colour', () => {
    expect(render([{ id: 'g1', type: 'cardGrid', props: { variant: 'imageCards', cards: [card] } }])).not.toContain('he-title-after');
    const html = render([{ id: 'g2', type: 'cardGrid', props: { variant: 'imageCards', cards: [{ ...card, titleAfter: '/ The Security Side', titleAfterColor: '#17bde7' }] } }]);
    expect(html).toMatch(/Northwind<span class="he-title-after" style="color:#17bde7"> \/ The Security Side<\/span>/);
  });
});

describe('the buttons’ arrow and “Read more”', () => {
  it('point right and keep their arrow until chosen', () => {
    const css = themeToCss(themeSchema.parse({}));
    expect(css).not.toContain('rotate(-45deg)');
    expect(css).not.toMatch(/\.he-more__icon\{display:none\}/);
  });

  it('turn only the arrow’s drawing, and can drop the Read-more arrow', () => {
    const css = themeToCss(themeSchema.parse({ buttons: { arrow: 'diagonal', more: 'none' } }));
    expect(css).toMatch(/svg:last-child>path[^{]*\{transform-box:fill-box;transform-origin:center;transform:rotate\(-45deg\)\}/);
    expect(css).toMatch(/\.he-more__icon\{display:none\}/);
  });
});

describe('the blog switched off', () => {
  it('is on until switched off', () => {
    expect(resolveBlog(undefined).off).toBe(false);
    expect(resolveBlog({ off: true }).off).toBe(true);
  });

  it('answers none of its addresses, its search, feeds or sitemap', () => {
    expect(read('src/server/content/resolve.ts')).toMatch(/blog\.off \? undefined : matches\.find/);
    expect(read('src/server/content/resolve.ts')).toContain("if (blog.off && BLOG_KINDS.has(match.kind)) continue;");
    expect(read('src/app/(site)/[locale]/%5Fsearch/page.tsx')).toContain('.off) notFound();');
    expect(read('src/app/(site)/[locale]/%5Ffeed/[[...category]]/route.ts')).toMatch(/\.off\) return new Response\('Not found', \{ status: 404 \}\)/);
    expect(read('src/app/sitemaps/blog.xml/route.ts')).toContain('.off) return new Response(urlSet([])');
  });
});

describe('a drop-down of several choices', () => {
  const field = { id: 'interests', type: 'multiselect', label: 'Interests', options: ['API', 'Cloud', 'Mobile'], required: true };

  it('answers as tick boxes do: only listed options, at least one when required', async () => {
    const { formFieldSchema, validateAnswers } = await import('@/lib/forms');
    const parsed = [formFieldSchema.parse(field)];
    expect(validateAnswers(parsed, { interests: ['API', 'Cloud'] }, parsed)).toMatchObject({ ok: true });
    expect(validateAnswers(parsed, { interests: [] }, parsed).ok).toBe(false);
    expect(validateAnswers(parsed, { interests: ['Nope'] }, parsed).ok).toBe(false);
  });

  it('renders closed, as a button naming what is chosen', async () => {
    vi.doMock('@/components/site/Messages', () => ({ useMessages: () => (key: string) => (key === 'form.choose' ? 'Choose…' : key) }));
    vi.doMock('@/components/site/Captcha', () => ({ useChallenge: () => ({ field: null, token: async () => '', reset: () => {} }) }));
    const { FormBlock } = await import('@/components/blocks/library/FormBlock');
    const { blockSchemas } = await import('@/lib/blocks');
    const props = blockSchemas.form.parse({ formName: 'Contact', fields: [field] });
    const html = renderToStaticMarkup(<FormBlock {...(props as unknown as Parameters<typeof FormBlock>[0])} />);
    expect(html).toMatch(/<button type="button" id="[^"]+" class="he-fb__input he-fb__multibtn" aria-expanded="false"/);
    expect(html).toContain('he-fb__multival is-empty">Choose…');
    expect(html).not.toContain('he-fb__multilist');
  });
});
