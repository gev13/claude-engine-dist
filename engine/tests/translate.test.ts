import { describe, expect, it } from 'vitest';
import { applyStrings, collectStrings, translationProgress } from '@/lib/translate';

/* ═══════════════════════════════════════════════════════════════════════════
   Pulling words out of a block tree
   ───────────────────────────────────────────────────────────────────────────
   Two failures matter, in opposite directions:

     • a sentence the extractor misses is a sentence nobody can translate, with
       nothing on screen to say why;
     • an image path or a hex colour offered as "text to translate" wastes a
       translator's attention and invites them to break the page.

   The first is worse, so the rule excludes technical keys rather than listing
   text ones — and these tests hold that line from both sides.
   ═══════════════════════════════════════════════════════════════════════════ */

/** A page as the builder really stores one, including the recursive row case. */
const PAGE = [
  {
    id: 'hero-1',
    type: 'hero',
    props: {
      eyebrow: 'About us',
      title: 'A studio built around making',
      intro: 'Twenty-two designers and engineers.',
      imageUrl: '/media/demo/workshop.webp',
      alt: 'The workshop at dusk',
      variant: 'classic',
      titleAs: 'h1',
      align: 'center',
      link: { label: 'Work with us', href: '/contact' },
    },
    style: { spacing: { base: 'lg' }, background: '#201e1d' },
  },
  {
    id: 'row-1',
    type: 'row',
    props: {
      align: 'stretch',
      columns: [
        {
          id: 'col-1',
          width: 6,
          blocks: [
            {
              id: 'text-1',
              type: 'text',
              props: { body: 'We make things that work.', prose: true },
            },
          ],
        },
        {
          id: 'col-2',
          width: 6,
          blocks: [
            {
              id: 'team-1',
              type: 'team',
              props: {
                title: 'The people',
                items: [
                  { name: 'Ada Lovelace', role: 'Engineer', imageUrl: '/media/ada.webp' },
                  { name: 'Alan Turing', role: 'Engineer', imageUrl: '/media/alan.webp' },
                ],
              },
            },
          ],
        },
      ],
    },
  },
];

describe('collectStrings', () => {
  const found = collectStrings(PAGE);
  const values = found.map((entry) => entry.value);

  it('finds the prose, wherever it sits', () => {
    expect(values).toContain('About us');
    expect(values).toContain('A studio built around making');
    expect(values).toContain('Twenty-two designers and engineers.');
    expect(values).toContain('Work with us');
  });

  it('reaches into rows, columns and the blocks inside them', () => {
    // The one recursive case in the whole vocabulary.
    expect(values).toContain('We make things that work.');
    expect(values).toContain('The people');
  });

  it('finds text inside arrays of items', () => {
    expect(values).toContain('Ada Lovelace');
    expect(values).toContain('Alan Turing');
    expect(values).toContain('Engineer');
  });

  it('treats a person’s name as translatable, because it is transliterated', () => {
    const ada = found.find((entry) => entry.value === 'Ada Lovelace');
    expect(ada?.key).toBe('name');
  });

  it('offers alt text, which a reader hears', () => {
    expect(values).toContain('The workshop at dusk');
  });

  it('never offers an identifier, an enum or a geometry value', () => {
    for (const technical of ['hero-1', 'row-1', 'col-1', 'text-1', 'hero', 'row', 'classic', 'h1', 'center', 'stretch']) {
      expect(values, technical).not.toContain(technical);
    }
  });

  it('never offers an address or a colour', () => {
    for (const technical of ['/media/demo/workshop.webp', '/contact', '#201e1d', '/media/ada.webp']) {
      expect(values, technical).not.toContain(technical);
    }
  });

  it('skips the whole Design panel, not just its keys', () => {
    // `style` holds spacing and colours; none of it is language.
    expect(found.some((entry) => entry.path.includes('style'))).toBe(false);
  });

  it('gives every string a path that says where it came from', () => {
    const title = found.find((entry) => entry.value === 'A studio built around making');
    expect(title?.path).toBe('0.props.title');

    const nested = found.find((entry) => entry.value === 'We make things that work.');
    expect(nested?.path).toBe('1.props.columns.0.blocks.0.props.body');

    const item = found.find((entry) => entry.value === 'Alan Turing');
    expect(item?.path).toBe('1.props.columns.1.blocks.0.props.items.1.name');
  });
});

describe('applyStrings', () => {
  it('writes a translation back exactly where it came from', () => {
    const translated = applyStrings(PAGE, {
      '0.props.title': 'Ստուդիա, որը կառուցված է ստեղծելու շուրջ',
      '1.props.columns.0.blocks.0.props.body': 'Մենք ստեղծում ենք բաներ, որոնք աշխատում են։',
    }) as typeof PAGE;

    expect(translated[0]!.props.title).toBe('Ստուդիա, որը կառուցված է ստեղծելու շուրջ');
    expect((translated[1]!.props.columns as never[])[0]).toMatchObject({
      blocks: [{ props: { body: 'Մենք ստեղծում ենք բաներ, որոնք աշխատում են։' } }],
    });
  });

  it('keeps the structure, the pictures and the layout untouched', () => {
    const translated = applyStrings(PAGE, { '0.props.title': 'Այլ' }) as typeof PAGE;
    expect(translated[0]!.props.imageUrl).toBe('/media/demo/workshop.webp');
    expect(translated[0]!.props.variant).toBe('classic');
    expect(translated[0]!.style).toEqual({ spacing: { base: 'lg' }, background: '#201e1d' });
    expect(translated[1]!.id).toBe('row-1');
  });

  it('leaves anything untranslated as it was, so a half-done page still reads', () => {
    const translated = applyStrings(PAGE, { '0.props.title': 'Այլ' }) as typeof PAGE;
    expect(translated[0]!.props.eyebrow).toBe('About us');
  });

  it('treats an empty box as "not translated yet", not as "delete this"', () => {
    const translated = applyStrings(PAGE, { '0.props.eyebrow': '' }) as typeof PAGE;
    expect(translated[0]!.props.eyebrow).toBe('About us');
  });

  it('does not mutate what it was given', () => {
    const before = JSON.stringify(PAGE);
    applyStrings(PAGE, { '0.props.title': 'Այլ' });
    expect(JSON.stringify(PAGE)).toBe(before);
  });

  it('round-trips: everything collected can be written back', () => {
    const strings = collectStrings(PAGE);
    const all = Object.fromEntries(strings.map((entry) => [entry.path, `«${entry.value}»`]));
    const translated = applyStrings(PAGE, all);
    for (const entry of collectStrings(translated)) {
      expect(entry.value.startsWith('«'), entry.path).toBe(true);
    }
  });
});

describe('translationProgress', () => {
  it('counts a fresh copy as entirely untranslated', () => {
    const progress = translationProgress(PAGE, structuredClone(PAGE));
    expect(progress.translated).toBe(0);
    expect(progress.remaining).toBe(progress.total);
    expect(progress.total).toBeGreaterThan(5);
  });

  it('counts what has actually changed', () => {
    const partly = applyStrings(PAGE, { '0.props.title': 'Այլ', '0.props.eyebrow': 'Մեր մասին' });
    const progress = translationProgress(PAGE, partly);
    expect(progress.translated).toBe(2);
    expect(progress.remaining).toBe(progress.total - 2);
  });

  it('counts a fully translated page as done', () => {
    const strings = collectStrings(PAGE);
    const all = Object.fromEntries(strings.map((entry) => [entry.path, `«${entry.value}»`]));
    const progress = translationProgress(PAGE, applyStrings(PAGE, all));
    expect(progress.remaining).toBe(0);
    expect(progress.translated).toBe(progress.total);
  });
});
