import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { chromeSchema, resolveChrome } from '@/lib/chrome';

/* 3.11 — a media band's text box (padding, inset, paragraph width, gaps),
   and a footer that can leave out its email and write its copyright as
   typed. All off until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const band = (extra: Record<string, unknown>) =>
  renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'b', type: 'mediaBand', props: { title: 'T', body: 'B', imageUrl: '/media/x.webp', ...extra } }] as never} />);
const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('a media band’s text box', () => {
  it('is the band’s own until set', () => {
    expect(band({})).not.toContain('has-text-box');
  });

  it('sets only what is given', () => {
    const html = band({ textBox: { paddingBlock: '88px', inset: '24px', bodyWidth: '467px', bodyGap: '28px', actionsGap: '40px' } });
    expect(html).toContain('has-text-box');
    for (const decl of ['--he-band-py:88px', '--he-band-inset:24px', '--he-band-body:467px', '--he-band-body-gap:28px', '--he-band-actions-gap:40px']) expect(html).toContain(decl);
    expect(band({ textBox: { bodyWidth: '400px' } })).not.toContain('--he-band-py');
    expect(read('src/styles/library-content.css')).toContain('.he-band__inner.has-text-box { padding-block: var(--he-band-py, 72px); }');
  });
});

describe('the footer', () => {
  it('shows its email and capitals as before', () => {
    const c = resolveChrome(undefined);
    expect(c.footer.email).toBe(true);
    expect(c.footer.copyrightCase).toBe('upper');
  });

  it('can leave the email out and write the copyright as typed', () => {
    const c = resolveChrome(chromeSchema.parse({ footer: { email: false, copyrightCase: 'asWritten' } }));
    expect(c.footer.email).toBe(false);
    expect(c.footer.copyrightCase).toBe('asWritten');
    expect(read('src/app/(site)/[locale]/layout.tsx')).toContain('email={chrome.footer.email ? settings.contactEmail : undefined}');
    expect(read('src/styles/library.css')).toContain('.he-ftr__copy.is-as-written { text-transform: none;');
  });
});

describe('the smoke suite', () => {
  it('knows a blog that is switched off', () => {
    expect(read('scripts/smoke.mjs')).toContain('const blogOff = blogEntries.length === 0');
  });
});
