import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';

/* 3.10 — two-column sections whose second column starts level with the
   heading, a FAQ's heading column of a set width, contained questions with
   inset lines, and a section's card-title type reaching FAQ questions. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);
const css = readFileSync(join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
const faq = (extra: Record<string, unknown>) =>
  render([{ id: 'f', type: 'faq', props: { eyebrow: 'FAQ', title: 'Questions', style: 'contained', items: [{ question: 'Q1', answer: 'A' }, { question: 'Q2', answer: 'B' }], ...extra } }]);

describe('two-column sections', () => {
  it('start the second column level with the eyebrow until told otherwise', () => {
    expect(render([{ id: 'p', type: 'prose', props: { eyebrow: 'E', title: 'T', columns: 'two', paragraphs: ['a'] } }])).not.toContain('he-align-title');
    expect(faq({})).not.toContain('he-align-title');
  });

  it('can start it level with the heading, when there is an eyebrow above it', () => {
    expect(render([{ id: 'p', type: 'prose', props: { eyebrow: 'E', title: 'T', columns: 'two', alignWithTitle: true, paragraphs: ['a'] } }])).toContain('he-align-title');
    expect(render([{ id: 'p', type: 'prose', props: { title: 'T', columns: 'two', alignWithTitle: true, paragraphs: ['a'] } }])).not.toContain('he-align-title');
    expect(faq({ alignWithTitle: true })).toContain('he-align-title');
    expect(css).toContain('.he-align-title > :nth-child(2) { margin-top: var(--he-title-offset, 46px); }');
  });
});

describe('a FAQ', () => {
  it('sets its heading column and insets its lines', () => {
    const html = faq({ headWidth: '460px', insetDividers: true });
    expect(html).toContain('he-faq-headw');
    expect(html).toContain('--he-faq-head:460px');
    expect(html).toContain('is-inset-lines');
  });

  it('takes the section’s card-title type for its questions', () => {
    expect(blockStyleToCss('f', blockStyleSchema.parse({ typography: { subheading: { size: '20px' } } }))).toContain('.he-b-f :is(h3,h4,h5,h6,.he-faq__btn){font-size:20px}');
  });
});
