import { describe, expect, it } from 'vitest';
import { blockSchemas, parseBlock } from '../src/lib/blocks';

/* Package 3, phase B: options added to blocks that already had stored
   content. Every stored block must keep parsing, and to the original look. */

describe('stored blocks keep their original look', () => {
  it('reads an old check list as ruled rows with ticks', () => {
    const block = parseBlock({ id: 'a', type: 'checkLists', props: { lists: [{ title: 'Covered', items: ['One', 'Two'] }] } });
    expect(block?.props).toMatchObject({ layout: 'rows', icon: 'check', lists: [{ items: ['One', 'Two'] }] });
  });

  it('reads an old spacer as a solid, full-width line', () => {
    expect(blockSchemas.spacer.parse({ line: 'rule' })).toMatchObject({ lineStyle: 'solid', lineWidth: 'full', ornament: 'none' });
  });

  it('reads an old image, heading and tabs unchanged', () => {
    expect(blockSchemas.image.parse({ url: '/x.webp' })).toMatchObject({ mask: 'none', size: 'full' });
    expect(blockSchemas.heading.parse({ title: 'Hi' })).toMatchObject({ textStyle: 'solid', rotateEffect: 'typing', highlightStyle: 'color' });
    expect(blockSchemas.tabs.parse({ tabs: [{ label: 'A' }] }).style).toBe('pill');
  });
});

describe('carousels, photo strips, stars and playlists', () => {
  const film = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

  it('rates testimonial slides and strip quotes in halves', () => {
    const slides = (rating: number) => ({ mode: 'quotes', slides: [{ body: 'Great', rating }] });
    expect(blockSchemas.carousel.safeParse(slides(4.5)).success).toBe(true);
    expect(blockSchemas.carousel.safeParse(slides(4.2)).success).toBe(false);
    expect(blockSchemas.marquee.safeParse({ kind: 'quotes', items: [{ quote: 'Great', rating: 5 }] }).success).toBe(true);
  });

  it('adds photos to the strip and carousel and featured layouts to posts and projects', () => {
    expect(blockSchemas.marquee.parse({ kind: 'photos', items: [{ imageUrl: '/media/x.webp' }] }).photoRatio).toBe('4/3');
    expect(blockSchemas.postList.safeParse({ variant: 'featured' }).success).toBe(true);
    expect(blockSchemas.postList.safeParse({ variant: 'carousel' }).success).toBe(true);
    expect(blockSchemas.projects.safeParse({ layout: 'carousel', items: [{ title: 'A' }] }).success).toBe(true);
  });

  it('checks every video in a playlist, as it checks the first', () => {
    const video = (source: string) => ({ source: film, videoTitle: 'One', playlist: [{ source, videoTitle: 'Two' }] });
    expect(blockSchemas.video.safeParse(video(film)).success).toBe(true);
    expect(blockSchemas.video.safeParse(video('https://evil.example/clip')).success).toBe(false);
    expect(blockSchemas.video.parse({ source: film, videoTitle: 'One' })).toMatchObject({ playlist: [], playlistPosition: 'side' });
  });
});

describe('the new options', () => {
  it('lets a list entry carry a safe link and small print', () => {
    const list = (item: unknown) => ({ lists: [{ items: [item] }] });
    expect(blockSchemas.checkLists.safeParse(list({ text: 'Design', href: '/services/design', note: 'In code' })).success).toBe(true);
    expect(blockSchemas.checkLists.safeParse(list({ text: 'Bad', href: 'javascript:alert(1)' })).success).toBe(false);
    expect(blockSchemas.checkLists.safeParse({ icon: 'skull', lists: [] }).success).toBe(false);
  });

  it('keeps masks, marks, effects and divider styles to closed lists', () => {
    expect(blockSchemas.image.safeParse({ url: '/x.webp', mask: 'hexagon' }).success).toBe(true);
    expect(blockSchemas.image.safeParse({ url: '/x.webp', mask: 'star' }).success).toBe(false);
    expect(blockSchemas.heading.safeParse({ title: 'Hi', highlight: 'Hi', highlightStyle: 'circle', rotateEffect: 'flip' }).success).toBe(true);
    expect(blockSchemas.heading.safeParse({ title: 'Hi', rotateEffect: 'explode' }).success).toBe(false);
    expect(blockSchemas.spacer.safeParse({ lineStyle: 'wave', ornament: 'star', label: 'Part two' }).success).toBe(true);
    expect(blockSchemas.spacer.safeParse({ lineStyle: 'glitter' }).success).toBe(false);
    expect(blockSchemas.tabs.safeParse({ style: 'switch', tabs: [{ label: 'A' }, { label: 'B' }] }).success).toBe(true);
  });
});
