import { describe, expect, it } from 'vitest';
import { blockTypes, migrateBlocks, parseBlock } from '../src/lib/blocks';

const block = (type: string, props: Record<string, unknown>) => ({ id: 'b1', type, props });

/* Merged blocks: pages saved before the merge must render exactly the content they had. */
describe('merged blocks keep working', () => {
  it('no longer offers the retired types', () => {
    for (const t of ['richText', 'statement', 'parallaxImage']) expect(blockTypes).not.toContain(t);
  });

  it('reads rich text as a Text block', () => {
    const b = parseBlock(block('richText', { title: 'Privacy', titleAs: 'h1', html: '<p>Hi</p>', variant: 'footnotes' }));
    expect(b?.type).toBe('prose');
    expect(b?.props).toMatchObject({ title: 'Privacy', titleAs: 'h1', html: '<p>Hi</p>', variant: 'footnotes', columns: 'one' });
  });

  it('reads a statement as a split heading that stays a paragraph', () => {
    const b = parseBlock(block('statement', { eyebrow: 'Why', statement: 'We build.', support: 'Since 2014.', animation: 'kinetic' }));
    expect(b?.type).toBe('heading');
    expect(b?.props).toMatchObject({
      eyebrow: 'Why',
      title: 'We build.',
      subtitle: 'Since 2014.',
      animation: 'kinetic',
      layout: 'split',
      size: 'lede',
      titleAs: 'p',
      tone: 'raised',
    });
    expect(parseBlock(block('statement', { statement: 'X', tone: 'base' }))?.props).toMatchObject({ tone: 'base', animation: 'none' });
  });

  it('reads a parallax image as a drifting media band', () => {
    const b = parseBlock(
      block('parallaxImage', {
        imageUrl: '/media/a.webp',
        direction: 'horizontal',
        strength: 'strong',
        overlay: 'dark',
        align: 'left',
        title: 'Drift',
        link: { label: 'Go', href: '/x' },
      }),
    );
    expect(b?.type).toBe('mediaBand');
    expect(b?.props).toMatchObject({
      imageUrl: '/media/a.webp',
      parallax: 'horizontal',
      strength: 'strong',
      overlay: 'medium',
      position: 'left',
      height: 'medium',
      title: 'Drift',
      links: [{ label: 'Go', href: '/x' }],
    });
    // A band with no text is still valid.
    expect(parseBlock(block('parallaxImage', { imageUrl: '/media/a.webp' }))?.props).toMatchObject({ title: '', links: [] });
  });

  it('reads a newsletter "heading with a button" as an inline call to action', () => {
    const b = parseBlock(block('newsletter', { layout: 'band', tone: 'raised', title: 'Letters', buttonLabel: 'Sign up', href: '/join' }));
    expect(b?.type).toBe('cta');
    expect(b?.props).toMatchObject({ variant: 'inline', tone: 'raised', title: 'Letters', links: [{ label: 'Sign up', href: '/join' }] });
    expect(parseBlock(block('newsletter', { title: 'Letters' }))?.type).toBe('newsletter');
  });

  it('converts the blocks inside rows too, which is what the builder edits', () => {
    const [row] = migrateBlocks([
      { id: 'r', type: 'row', props: { columns: [{ id: 'c', width: {}, blocks: [block('richText', { html: '<p>x</p>' })] }] } },
    ]);
    const columns = row!.props.columns as { blocks: { type: string }[] }[];
    expect(columns[0]!.blocks[0]!.type).toBe('prose');
  });
});
