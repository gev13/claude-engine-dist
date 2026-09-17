// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BandProbe from '@/app/(system)/admin/band/[type]/page';
import { sampleBlock } from '@/content/demo/samples';

/* ═══════════════════════════════════════════════════════════════════════════
   The Design panel's spacing probe, rendered
   ───────────────────────────────────────────────────────────────────────────
   When the measured spacing did not appear, there were two candidates: the
   page did not render, or the browser refused to load it. It was the second —
   the admin's own `frame-src` listed the video and map embeds and not
   `'self'`, so the panel could not frame a page from its own origin and the
   measurement came back empty with nothing said about why.

   This pins the first candidate so the next investigation starts in the right
   place: the page renders, and it renders something with a band inside it.

   A curated list rather than every type, because `renderToStaticMarkup` does
   not resolve async server components — the blocks that read the database
   (`postList`, `servicesIndex`) cannot be rendered here without one.
   `tests/bandProbe.test.ts` covers all 63 types at the level that does not
   need rendering: that each has a sample, and that the sample parses.
   ═══════════════════════════════════════════════════════════════════════════ */

const SYNCHRONOUS = ['hero', 'cta', 'prose', 'faq', 'quote', 'stats', 'cardGrid', 'heading', 'image', 'table'];

const render = async (type: string) => {
  const element = await BandProbe({ params: Promise.resolve({ type }) });
  return renderToStaticMarkup(element as React.ReactElement);
};

describe('the probe page', () => {
  it('renders a band the panel can measure', async () => {
    for (const type of SYNCHRONOUS) {
      const html = await render(type);
      expect(html, type).toContain('id="he-band"');
      // Something has to be inside it, or there is nothing to measure.
      const inside = html.replace(/^.*id="he-band"[^>]*>/s, '');
      expect(inside.length, type).toBeGreaterThan(20);
    }
  });

  it('names the type it rendered, so a wrong measurement can be traced', async () => {
    expect(await render('hero')).toContain('data-block-type="hero"');
  });

  it('has a sample for each of these, which is what makes them renderable', () => {
    for (const type of SYNCHRONOUS) expect(sampleBlock(type), type).not.toBeNull();
  });
});
