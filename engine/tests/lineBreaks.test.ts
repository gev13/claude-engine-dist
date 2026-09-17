import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   A line break somebody typed is content
   ───────────────────────────────────────────────────────────────────────────
   Somebody types blank lines into a Body or Intro field expecting paragraphs.
   HTML collapses every one of them, the text arrives as one run-on block, and
   nothing on the page or in the editor says why.

   It was fixed once, on the text block alone, after being reported from real
   use — and reported again months later from a different block, because the
   fix was a class on one component rather than a rule. It is a rule now, so a
   block added next year does not have the bug again.

   The exclusion is the half that could do damage: `.prose-edge` is the rich
   text editor's own HTML, where newlines are formatting in the markup rather
   than anything an author typed. Honouring them there adds breaks nobody
   asked for, in the one place authors already have real paragraphs.
   ═══════════════════════════════════════════════════════════════════════════ */

const css = readFileSync(fileURLToPath(new URL('../src/styles/library-blocks.css', import.meta.url)), 'utf8');

const rule = css.slice(css.indexOf('.he-site :is(p'), css.indexOf('}', css.indexOf('.he-site :is(p')) + 1);

describe('the rule', () => {
  it('exists, and preserves newlines rather than all whitespace', () => {
    expect(rule).toContain('white-space: pre-line');
    /* `pre` or `pre-wrap` would also preserve runs of spaces and turn prose
       into preformatted text. Only the newlines are wanted. */
    expect(rule).not.toMatch(/white-space:\s*pre(-wrap)?;/);
  });

  it('covers the elements a plain-text field is rendered into', () => {
    for (const element of ['p', 'li', 'blockquote', 'figcaption']) {
      expect(rule, element).toMatch(new RegExp(`\\b${element}\\b`));
    }
  });

  it('excludes the rich-text editor’s own HTML, and its descendants', () => {
    expect(rule).toContain(':not(.prose-edge, .prose-edge *)');
  });

  it('is scoped to the site, so the admin is untouched', () => {
    expect(rule.startsWith('.he-site')).toBe(true);
  });
});

describe('it does not fight the component that already did this', () => {
  it('leaves the text block’s own utility in place', () => {
    const blocks = readFileSync(fileURLToPath(new URL('../src/components/blocks/index.tsx', import.meta.url)), 'utf8');
    // A Tailwind utility beats a components-layer rule; both say the same
    // thing, so the block keeps working whichever wins.
    expect(blocks).toContain('whitespace-pre-line');
  });
});
