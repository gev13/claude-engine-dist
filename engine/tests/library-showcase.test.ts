import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';
import { buildCsp } from '../src/lib/csp';
import { EMBED_ORIGINS, mapEmbedUrl, mapLinkUrl, parseVideoUrl, videoEmbedUrl } from '../src/lib/embeds';

describe('video links (EL10)', () => {
  it('reads YouTube links in their usual shapes', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://youtu.be/aqz-KE-bpKQ',
      'https://m.youtube.com/watch?v=aqz-KE-bpKQ&t=30',
      'https://www.youtube.com/shorts/aqz-KE-bpKQ',
      'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
    ]) {
      expect(parseVideoUrl(url), url).toEqual({ kind: 'youtube', id: 'aqz-KE-bpKQ' });
    }
  });

  it('reads Vimeo links, including unlisted ones', () => {
    expect(parseVideoUrl('https://vimeo.com/1084537')).toEqual({ kind: 'vimeo', id: '1084537' });
    expect(parseVideoUrl('https://player.vimeo.com/video/1084537')).toEqual({ kind: 'vimeo', id: '1084537' });
    expect(parseVideoUrl('https://vimeo.com/1084537/abcdef1234')).toEqual({ kind: 'vimeo', id: '1084537', hash: 'abcdef1234' });
  });

  it('accepts an uploaded file and nothing else', () => {
    expect(parseVideoUrl('/media/uploads/film.mp4')).toEqual({ kind: 'file', src: '/media/uploads/film.mp4' });
    for (const bad of [
      'http://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://youtu.be/short',
      'https://evil.test/youtube.com/watch?v=aqz-KE-bpKQ',
      'https://example.com/film.mp4',
      '/media/../secret.mp4',
      'javascript:alert(1)',
      '',
    ]) {
      expect(parseVideoUrl(bad), bad).toBeNull();
    }
  });

  it('plays YouTube from its no-cookie domain and asks Vimeo not to track', () => {
    expect(videoEmbedUrl({ kind: 'youtube', id: 'aqz-KE-bpKQ' })).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ\?/);
    expect(videoEmbedUrl({ kind: 'vimeo', id: '1084537' })).toContain('dnt=1');
  });

  it('rejects a video block whose link it cannot play', () => {
    expect(blockSchemas.video.safeParse({ source: 'https://example.com/x', videoTitle: 'T' }).success).toBe(false);
    expect(blockSchemas.video.safeParse({ source: 'https://youtu.be/aqz-KE-bpKQ', videoTitle: '' }).success).toBe(false);
    expect(blockSchemas.video.parse({ source: 'https://youtu.be/aqz-KE-bpKQ', videoTitle: 'T' })).toMatchObject({ display: 'inline', buttonStyle: 'filled' });
  });
});

describe('maps (EL14)', () => {
  const place = { provider: 'openstreetmap' as const, address: '1 Example Street', lat: 51.5138, lng: -0.0984, zoom: 15 };

  it('centres OpenStreetMap on the coordinates, and needs them', () => {
    const url = mapEmbedUrl(place);
    expect(url).toMatch(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/);
    expect(url).toContain('marker=51.5138%2C-0.0984');
    expect(mapEmbedUrl({ ...place, lat: undefined, lng: undefined })).toBeNull();
    expect(mapLinkUrl({ ...place, lat: undefined, lng: undefined })).toBe('https://www.openstreetmap.org/search?query=1%20Example%20Street');
  });

  it('lets Google search the address when there are no coordinates', () => {
    expect(mapEmbedUrl({ ...place, provider: 'google', lat: undefined, lng: undefined })).toBe(
      'https://www.google.com/maps?q=1%20Example%20Street&z=15&output=embed',
    );
  });

  it('lets exactly these embeds through the Content-Security-Policy', () => {
    // Since 2.16 every policy is built by lib/csp.ts; with nothing switched on, frames are the embeds alone.
    const frameSrc = /frame-src ([^;]+)/.exec(buildCsp({ isProd: true }))?.[1]?.split(' ') ?? [];
    expect(frameSrc.sort()).toEqual([...EMBED_ORIGINS].sort());
    expect(readFileSync('next.config.ts', 'utf8')).toContain('buildCsp');
  });

  it('keeps coordinates on the globe', () => {
    expect(blockSchemas.map.safeParse({ address: 'A', lat: 91, lng: 0 }).success).toBe(false);
    expect(blockSchemas.map.safeParse({ address: '' }).success).toBe(false);
  });
});

describe('compare, gallery, accordion, projects, steps', () => {
  it('needs both pictures to compare', () => {
    expect(blockSchemas.compare.safeParse({ beforeUrl: '/media/a.webp' }).success).toBe(false);
    expect(blockSchemas.compare.parse({ beforeUrl: '/media/a.webp', afterUrl: '/media/b.webp' })).toMatchObject({ orientation: 'horizontal', start: 50 });
  });

  it('keeps a gallery between 1 and 40 pictures', () => {
    const picture = { url: '/media/a.webp' };
    expect(blockSchemas.gallery.safeParse({ images: [] }).success).toBe(false);
    expect(blockSchemas.gallery.safeParse({ images: Array.from({ length: 41 }, () => picture) }).success).toBe(false);
    expect(blockSchemas.gallery.safeParse({ images: [{ url: 'javascript:alert(1)' }] }).success).toBe(false);
  });

  it('needs at least two accordion panels', () => {
    expect(blockSchemas.horizontalAccordion.safeParse({ panels: [{ title: 'A' }] }).success).toBe(false);
    expect(blockSchemas.horizontalAccordion.safeParse({ panels: [{ title: 'A' }, { title: 'B' }] }).success).toBe(true);
  });

  it('checks project links', () => {
    expect(blockSchemas.projects.safeParse({ items: [{ title: 'A', href: 'javascript:alert(1)' }] }).success).toBe(false);
    expect(blockSchemas.projects.parse({ items: [{ title: 'A' }] })).toMatchObject({ layout: 'classic', filter: true, allLabel: 'All' });
  });

  it('parses a stored numbered list as the original grid', () => {
    expect(blockSchemas.numberedList.parse({ items: [{ title: 'A', body: 'B' }] }).variant).toBe('grid');
  });
});
