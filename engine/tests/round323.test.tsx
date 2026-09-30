import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '@/components/ui/Card';
import { blockSchemas } from '@/lib/blocks';
import { rowToCss } from '@/lib/blockStyle-css';
import { archivePerPage, blogSchema, resolveBlog } from '@/lib/blog';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { cookieNoticeSchema } from '@/lib/cookies';
import { hasPostList } from '@/lib/listing';
import { projectTemplateSchema, resolveProjectTemplate } from '@/lib/projects';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.23 — round 4 of the parity list: the blog index with a page, column CSS per
   row, one "Read more", section rules on every page, and the settings for the
   main pages and the details. Every option is off, or as before, until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const styles = join(__dirname, '../src/styles');
const css = (file: string) => readFileSync(join(styles, file), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('B1 — a page at the blog index keeps the built-in list unless it lists posts itself', () => {
  const heading = { id: 'h', type: 'heading', props: { title: 'Blog' } };
  const list = { id: 'l', type: 'postList', props: {} };
  it('finds a post list at the top, inside a row, and skips a switched-off one', () => {
    expect(hasPostList([heading] as never)).toBe(false);
    expect(hasPostList([heading, list] as never)).toBe(true);
    expect(hasPostList([{ id: 'r', type: 'row', props: { columns: [{ id: 'c0', blocks: [list] }] } }] as never)).toBe(true);
    expect(hasPostList([{ ...list, style: { disabled: true } }] as never)).toBe(false);
    expect(hasPostList(undefined)).toBe(false);
  });
});

describe('B4 — a column’s rules belong to its row', () => {
  it('scopes a column’s style to its own row', () => {
    const out = rowToCss({ id: 'r1', columns: [{ id: 'c0', width: { base: 6 }, style: { hideAt: ['mobile'] } }, { id: 'c1', width: { base: 6 } }] } as never);
    expect(out).toContain('.he-r-r1>.he-c-c0');
    expect(out).not.toMatch(/(^|[},])\.he-c-c0/);
  });
});

describe('B5 — one “Read more” on a card', () => {
  it('prints the link line once, and none when the card says so', () => {
    const one = renderToStaticMarkup(<Card href="/a" title="A" moreLabel="Read more" />);
    expect(one.match(/Read more/g)).toHaveLength(1);
    const none = renderToStaticMarkup(<Card href="/a" title="A" moreLabel="Read more" more={false} />);
    expect(none).not.toContain('Read more');
  });
});

describe('B3/B6/R9/R15 — the theme', () => {
  it('writes nothing new for a theme that does not ask', () => {
    expect(theme({})).toBe('');
    expect(theme({ layout: { nestedFlush: false } })).not.toContain('he-nested');
  });

  it('flattens blocks in a column only when asked', () => {
    expect(theme({ layout: { nestedFlush: true } })).toContain(':where(.he-nested section){padding-block:0}');
  });

  it('reaches a project’s and a post’s sections with the rules off', () => {
    expect(theme({ layout: { sectionRules: false } })).toContain('#main>article>*');
  });

  it('sets the space under an eyebrow as a length, never free text', () => {
    expect(theme({ layout: { eyebrowGap: '12px' } })).toContain('.he-site .he-eyebrow{margin-bottom:12px}');
    expect(themeSchema.safeParse({ layout: { eyebrowGap: '12px;color:red' } }).success).toBe(false);
  });

  it('draws the pager as squares with its own colours', () => {
    const out = theme({ pager: { shape: 'square', activeBackground: '#555555', activeText: '#ffffff', font: 'body' } });
    expect(out).toContain('--he-pager-radius:8px');
    expect(out).toContain('--he-pager-active-bg:#555555');
    expect(out).toContain('--he-pager-active-text:#ffffff');
    expect(out).toContain('--he-pager-family:inherit');
    expect(theme({ pager: { shape: 'circle' } })).not.toContain('--he-pager-radius');
    expect(css('library-layouts.css')).toContain('var(--he-pager-radius');
  });
});

describe('R1–R6 — the blog', () => {
  it('pages categories on their own number, else as before', () => {
    expect(archivePerPage(resolveBlog(undefined), 'category')).toBe(archivePerPage(resolveBlog(undefined), 'research'));
    expect(archivePerPage(resolveBlog({ categoryPerPage: 9, archivePerPage: 12 }), 'category')).toBe(9);
    expect(archivePerPage(resolveBlog({ categoryPerPage: 9, archivePerPage: 12 }), 'index')).toBe(12);
  });

  it('checks the new options', () => {
    expect(blogSchema.safeParse({ card: { excerpt: false, categoryPlace: 'under' } }).success).toBe(true);
    expect(blogSchema.safeParse({ post: 'coverThenColumn', coverHeight: '600px', coverHeightMobile: '50vw' }).success).toBe(true);
    expect(blogSchema.safeParse({ coverHeight: '600px;x' }).success).toBe(false);
    expect(blogSchema.safeParse({ categoryLabel: 'subtitle', indexSeo: { title: 'Blog', exactTitle: true } }).success).toBe(true);
  });

  it('keeps stored post lists, and takes the card’s excerpt and chip', () => {
    expect(blockSchemas.postList.safeParse({}).success).toBe(true);
    expect(blockSchemas.postList.safeParse({ card: { excerpt: false, categoryPlace: 'under' } }).success).toBe(true);
  });
});

describe('R7/R8 — projects and the gallery', () => {
  it('keeps the template as it was, and checks the new sizes as lengths', () => {
    const plain = resolveProjectTemplate({});
    expect(plain.heroHeight).toBeUndefined();
    expect(plain.headWidth).toBeUndefined();
    expect(plain.categoryStyle).toBeUndefined();
    expect(projectTemplateSchema.safeParse({ heroHeight: '640px', heroHeightMobile: '360px', headWidth: '42%', categoryStyle: 'plain' }).success).toBe(true);
    expect(projectTemplateSchema.safeParse({ headWidth: 'red' }).success).toBe(false);
  });

  it('lets a gallery drop to one column on phones, with rounded pictures', () => {
    const base = { images: [{ url: '/media/a.jpg', alt: '' }] };
    expect(blockSchemas.gallery.safeParse({ ...base, columnsTablet: 2, columnsMobile: 1, radius: 15 }).success).toBe(true);
    expect(blockSchemas.gallery.safeParse({ ...base, columnsMobile: 0 }).success).toBe(false);
    expect(css('library-showcase.css')).toContain('--he-gal-radius');
  });
});

describe('R10–R14 — the chrome and the cookie notice, off until chosen', () => {
  it('keeps every new chrome option at what the site already did', () => {
    const c = resolveChrome(undefined);
    expect(c.header.ctaBorderWidth).toBeUndefined();
    expect(c.header.menuButtonBackground).toBeUndefined();
    expect(c.footer.legalSeparator).toBe('none');
    expect(resolveChrome({ rails: { enabled: true } } as never).rails?.networks).toBeUndefined();
  });

  it('checks colours and networks as values', () => {
    expect(chromeSchema.safeParse({ header: { menuButtonBackground: 'rgba(0,0,0,0.5)', ctaBorderWidth: 1 } }).success).toBe(true);
    expect(chromeSchema.safeParse({ header: { menuButtonBackground: 'red;x' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ rails: { networks: ['linkedin', 'behance', 'instagram'] } }).success).toBe(true);
    expect(chromeSchema.safeParse({ rails: { networks: ['myspace'] } }).success).toBe(false);
  });

  it('adds the pill at the bottom centre, with a close button, and keeps the old notice', () => {
    expect(cookieNoticeSchema.safeParse({}).success).toBe(true);
    const pill = cookieNoticeSchema.safeParse({ position: 'bottom-center', look: 'pill', closeButton: true, background: '#2255cc', textColor: '#ffffff', radius: 8, width: 480 });
    expect(pill.success).toBe(true);
    expect(cookieNoticeSchema.safeParse({ background: 'url(x)' }).success).toBe(false);
  });
});
