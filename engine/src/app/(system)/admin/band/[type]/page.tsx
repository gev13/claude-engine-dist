import { notFound } from 'next/navigation';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { sampleBlock } from '@/content/demo/samples';
import { blockSchemas, parseBlocks } from '@/lib/blocks';
import { themeToCss } from '@/lib/theme-css';
import { getTheme } from '@/server/content/theme';

/* Reads the site's saved theme, so it cannot be prerendered once and reused. */
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   One block, rendered so its own spacing can be measured
   ───────────────────────────────────────────────────────────────────────────
   The Design panel wants to tell an editor what padding a block already has
   before they type over it. That number is not the theme's and not the
   panel's: every block paints its own band, in its own stylesheet, often
   differently at each width. There are 63 block types and 48 separate
   `padding-block` rules, so a table of the answers in TypeScript would be
   wrong within a release and wrong silently.

   So nothing is tabulated. This renders the real component with the real
   stylesheets, and the panel measures it in a hidden iframe at each
   breakpoint — the browser does the cascade, which is the only thing that
   knows the answer. A new block type is measurable the day it is added, with
   nothing to remember.

   The sample comes from the block library's own demo content, which already
   holds a valid instance of every type — `tests/demo-content.test.ts` fails
   the build if one is missing, so that guarantee is enforced rather than
   hoped for.

   Admin-only by virtue of living under `/admin`, which middleware gates. It
   renders no site content and takes no parameters beyond a block type that
   must exist in the schema.
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function BandProbe({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(type in blockSchemas)) notFound();

  const sample = sampleBlock(type);
  if (!sample) notFound();

  /* Rendered through the ordinary pipeline, so what is measured is what a
     visitor would get — a sample that failed to parse would be dropped here
     exactly as it would on a page. */
  const parsed = parseBlocks([sample]);
  if (parsed.length === 0) notFound();

  /* The site's own theme, not the shipped defaults.
     
     This page renders under the *admin* layout, which loads `globals.css` and
     therefore the `--he-*` properties at their shipped values. A site whose
     palette was changed in Appearance would then be measured against colours
     nobody is looking at — and a wrong colour in the panel is worse than no
     colour, because an editor cannot tell it is wrong. So the same style
     element the public layout writes is written here. */
  const css = themeToCss(await getTheme());

  /* The style element sits *outside* the band: the panel measures
     `#he-band`'s first child, and a <style> is an element like any other —
     inside, it would be the thing measured. A style element applies to the
     whole document wherever it sits, so nothing is lost by moving it. */
  return (
    <>
      {css && <style id="he-theme" dangerouslySetInnerHTML={{ __html: css }} />}
      <div id="he-band" data-block-type={type}>
        <BlockRenderer blocks={[sample]} />
      </div>
    </>
  );
}
