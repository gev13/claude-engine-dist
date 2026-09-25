import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { etagFor, ifRangeHolds, parseRange } from '@/lib/httpRange';
import { RESPONSIVE_WIDTHS, isResizable, requestedWidth, responsiveAttrs, setImageMode, variantFilename, widthsFor } from '@/lib/responsive';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteImg } from '@/components/ui/SiteImg';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { canUploadSvg, mediaSettingsSchema } from '@/lib/mediaSettings';
import { probeVideo } from '@/server/media/probe';
import { cleanSvg, safeSvgCss } from '@/server/media/svg';

/* 2.17 — byte ranges, video headers, SVG cleaning and responsive images. */

describe('byte ranges', () => {
  it('reads the ranges players ask for', () => {
    expect(parseRange('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 });
    expect(parseRange('bytes=0-1023', 5000)).toEqual({ start: 0, end: 1023 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('refuses a range wholly past the end', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 1000)).toBe('unsatisfiable');
  });

  it('answers anything else with the whole file', () => {
    for (const header of [null, '', 'items=0-1', 'bytes=0-1,5-9', 'bytes=9-2', 'bytes=-', 'bytes=abc']) {
      expect(parseRange(header, 1000), String(header)).toBeNull();
    }
  });

  it('serves a range only while If-Range still names this file', () => {
    const etag = etagFor(1000, 1_700_000_000_000);
    expect(ifRangeHolds(null, etag, 1_700_000_000_000)).toBe(true);
    expect(ifRangeHolds(etag, etag, 1_700_000_000_000)).toBe(true);
    expect(ifRangeHolds('"other"', etag, 1_700_000_000_000)).toBe(false);
    expect(ifRangeHolds(new Date(1_700_000_000_000).toUTCString(), etag, 1_700_000_000_000)).toBe(true);
    expect(ifRangeHolds(new Date(1_600_000_000_000).toUTCString(), etag, 1_700_000_000_000)).toBe(false);
  });
});

describe('video headers', () => {
  const file = (name: string) => readFileSync(`tests/fixtures/video/${name}`);

  it('reads an mp4’s size and length', () => {
    expect(probeVideo(file('sample.mp4'), 'mp4')).toMatchObject({ width: 320, height: 180 });
    expect(probeVideo(file('sample.mp4'), 'mp4')?.durationMs).toBeGreaterThanOrEqual(1400);
  });

  it('turns a video recorded upright the right way up', () => {
    expect(probeVideo(file('rotated.mp4'), 'mp4')).toMatchObject({ width: 180, height: 320 });
  });

  it('reads a webm’s size and length', () => {
    const info = probeVideo(file('sample.webm'), 'webm');
    expect(info).toMatchObject({ width: 320, height: 180 });
    expect(info?.durationMs).toBeGreaterThanOrEqual(1400);
  });

  it('answers null for anything it cannot read, never throws', () => {
    expect(probeVideo(Buffer.from('not a video at all'), 'mp4')).toBeNull();
    expect(probeVideo(file('sample.mp4').subarray(0, 40), 'mp4')).toBeNull();
    expect(probeVideo(file('sample.webm').subarray(0, 30), 'webm')).toBeNull();
    expect(probeVideo(Buffer.alloc(0), 'webm')).toBeNull();
  });
});

describe('SVG cleaning', () => {
  it('keeps the drawing and drops the script', () => {
    const cleaned = cleanSvg(
      '<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12" onload="alert(1)">' +
        '<script>alert(2)</script><foreignObject><div>html</div></foreignObject>' +
        '<a href="https://evil.example"><rect width="10" height="10"/></a>' +
        '<circle cx="5" cy="5" r="4" fill="red" onclick="alert(3)"/>' +
        '<use href="#c"/><use xlink:href="https://evil.example/x.svg#a"/>' +
        '<set attributeName="href" to="javascript:alert(4)"/></svg>',
    )!;
    expect(cleaned.svg).toContain('<circle');
    expect(cleaned.svg).toContain('viewBox="0 0 24 12"');
    expect(cleaned.svg).toContain('<use href="#c"/>');
    for (const bad of ['script', 'alert', 'onload', 'onclick', 'foreignObject', 'evil.example', '<a ', '<set', 'DOCTYPE']) {
      expect(cleaned.svg, bad).not.toContain(bad);
    }
    expect(cleaned).toMatchObject({ width: 24, height: 12 });
  });

  it('keeps a stylesheet but lets it fetch nothing', () => {
    const cleaned = cleanSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><style><![CDATA[@import url(https://x.test/a.css); .a{fill:#f00;background:url(https://x.test/t.png)} .b{fill:url(#g)}]]></style><rect class="a" style="fill:url(//x.test/p)"/></svg>',
    )!;
    expect(cleaned.svg).toContain('.a{fill:#f00;background:none}');
    expect(cleaned.svg).toContain('fill:url(#g)');
    expect(cleaned.svg).not.toContain('x.test');
    expect(cleaned.svg).not.toContain('@import');
    expect(safeSvgCss('a{b:expression(alert(1))}')).not.toContain('expression');
  });

  it('allows an embedded raster, but nothing else by data', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(cleanSvg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="${png}"/></svg>`)!.svg).toContain(png);
    expect(cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="data:text/html,<script>x</script>"/></svg>')!.svg).not.toContain('data:');
  });

  it('refuses a file that is not an SVG', () => {
    expect(cleanSvg('<html><body>hi</body></html>')).toBeNull();
    expect(cleanSvg('just text')).toBeNull();
  });
});

describe('responsive images', () => {
  it('resizes pictures from the library, not GIFs, SVGs or other sites', () => {
    expect(isResizable('/media/2026/09/abc.png')).toBe(true);
    expect(isResizable('/media/2026/09/abc.JPG')).toBe(true);
    for (const url of ['/media/2026/09/abc.gif', '/media/2026/09/abc.svg', 'https://cdn.example.com/a.png', '/media/../x.png', '/images/a.png', '/media/a.png?w=1']) {
      expect(isResizable(url), url).toBe(false);
    }
  });

  it('names copies beside the original, never wider than it', () => {
    expect(variantFilename('2026/09/abc.png', 480, 'webp')).toBe('2026/09/abc.w480.webp');
    expect(widthsFor(1200)).toEqual([480, 768, 1024]);
    expect(widthsFor(400)).toEqual([]);
    expect(widthsFor(null)).toEqual([]);
  });

  it('snaps a requested width up to one that exists', () => {
    expect(requestedWidth('480')).toBe(480);
    expect(requestedWidth('500')).toBe(768);
    expect(requestedWidth('9999')).toBeNull();
    expect(requestedWidth('abc')).toBeNull();
    expect(requestedWidth(null)).toBeNull();
  });

  it('adds nothing to the markup while switched off', () => {
    setImageMode(false);
    expect(responsiveAttrs('/media/2026/09/abc.png')).toEqual({});
    setImageMode(true);
    const attrs = responsiveAttrs('/media/2026/09/abc.png', 'third');
    expect(attrs.srcSet?.split(', ')).toHaveLength(RESPONSIVE_WIDTHS.length);
    expect(attrs.srcSet).toContain('/media/2026/09/abc.png?w=480 480w');
    expect(attrs.sizes).toContain('33vw');
    expect(responsiveAttrs('/media/2026/09/abc.gif')).toEqual({});
    setImageMode(false);
  });
});

describe('the image component', () => {
  it('renders exactly the img it was given while responsive images are off', () => {
    setImageMode(false);
    expect(renderToStaticMarkup(<SiteImg src="/media/a.png" alt="A" className="x" loading="lazy" sizes="third" priority />)).toBe(
      '<img src="/media/a.png" alt="A" class="x" loading="lazy"/>',
    );
  });

  it('adds sizes, lazy loading and priority once on', () => {
    setImageMode(true);
    const hero = renderToStaticMarkup(<SiteImg src="/media/a.png" alt="" priority />);
    expect(hero).toContain('srcSet="/media/a.png?w=480 480w');
    expect(hero).toContain('loading="eager"');
    expect(hero).toContain('fetchPriority="high"');
    expect(renderToStaticMarkup(<SiteImg src="/media/a.gif" alt="" />)).not.toContain('srcSet');
    setImageMode(false);
  });
});

describe('a section with a film behind it', () => {
  it('takes only files from the media library', () => {
    expect(blockStyleSchema.safeParse({ background: { videoUrl: '/media/2026/09/a.mp4' } }).success).toBe(true);
    for (const url of ['https://cdn.example.com/a.mp4', '/media/a.mov', 'javascript:alert(1)', '/media/"a.mp4']) {
      expect(blockStyleSchema.safeParse({ background: { videoUrl: url } }).success, url).toBe(false);
    }
  });

  it('opens a stacking context and clears the band so the film shows', () => {
    const css = blockStyleToCss('b1', blockStyleSchema.parse({ background: { videoUrl: '/media/a.mp4' } }));
    expect(css).toContain('.he-b-b1{position:relative;isolation:isolate}');
    expect(css).toContain('.he-b-b1>*{background:transparent}');
  });
});

describe('who may upload an SVG', () => {
  it('is administrators and managers until somebody changes it', () => {
    const settings = mediaSettingsSchema.parse({});
    expect(canUploadSvg(settings, 'admin')).toBe(true);
    expect(canUploadSvg(settings, 'manager')).toBe(true);
    expect(canUploadSvg(settings, 'author')).toBe(false);
    expect(settings.responsive).toBe(false);
  });
});
