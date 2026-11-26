import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { chromeSchema } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';

/* 3.38.3 — a text block's eyebrow and title placed as one group, and the
   space between the language codes in the open menu. Off until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (k: string) => k }));

const prose = async (props: Record<string, unknown>) => {
  const { ProseBlock } = await import('@/components/blocks/index');
  return renderToStaticMarkup(<ProseBlock {...blockSchemas.prose.parse({ eyebrow: 'E', title: 'T', paragraphs: ['P'], ...props })} />);
};

describe('a text block’s eyebrow and title as one group', () => {
  it('renders nothing round them unset', async () => {
    expect(await prose({})).not.toContain('he-prose__head');
    expect(await prose({ eyebrow: undefined, title: undefined, headPlace: 'center' })).not.toContain('he-prose__head');
  });
  it('groups them, the paragraphs outside the group', async () => {
    const html = await prose({ headPlaceMobile: 'center' });
    expect(html).toMatch(/<div class="he-prose__head is-hp-m-center">.*T<\/h2><\/div><p/);
    expect(await prose({ headPlace: 'center', headPlaceMobile: 'start' })).toContain('class="he-prose__head is-hp-center is-hp-m-start"');
    expect(blockSchemas.prose.safeParse({ headPlace: 'middle' }).success).toBe(false);
  });
});

describe('the language codes’ gap in the open menu', () => {
  it('is written only when set, and only as a length', () => {
    expect(chromeCss(chromeSchema.parse({ languages: { look: 'inline' } }))).not.toContain('he-menu__langs{gap');
    expect(chromeCss(chromeSchema.parse({ languages: { menuGap: '16px' } }))).toContain('.he-menu .he-langs.he-menu__langs{gap:16px}');
    expect(chromeSchema.safeParse({ languages: { menuGap: '1px;}' } }).success).toBe(false);
  });
});
