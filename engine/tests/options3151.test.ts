import { beforeEach, describe, expect, it, vi } from 'vitest';

/* 3.15.1 — the sitemap index lists a segment only when it has something in
   it: a live blog with a post, an open role, a published project. */

const state = { off: false, posts: [] as { indexable: boolean }[], jobs: [] as { isOpen: boolean }[], projects: [] as { indexable: boolean }[] };
vi.mock('@/server/content/theme', () => ({ getTheme: async () => ({ blog: state.off ? { off: true } : {} }) }));
vi.mock('@/server/content/posts', () => ({ allPublishedPostsByGroup: async () => state.posts }));
vi.mock('@/server/content/jobs', () => ({ allPublishedJobsByGroup: async () => state.jobs }));
vi.mock('@/server/content/projects', () => ({ allPublishedProjects: async () => state.projects }));
vi.mock('@/server/routing/config', () => ({ getPermalinks: async () => ({}) }));

const { GET: index } = await import('@/app/sitemap.xml/route');
const { GET: careers } = await import('@/app/sitemaps/careers.xml/route');
const read = async (r: Response | Promise<Response>) => (await r).text();

beforeEach(() => Object.assign(state, { off: false, posts: [], jobs: [], projects: [] }));

describe('the sitemap index', () => {
  it('always lists pages and services, and nothing empty', async () => {
    const xml = await read(index());
    expect(xml).toContain('/sitemaps/pages.xml');
    expect(xml).toContain('/sitemaps/services.xml');
    expect(xml).not.toMatch(/blog\.xml|careers\.xml|projects\.xml/);
  });

  it('lists the blog, careers and projects once they have something', async () => {
    Object.assign(state, { posts: [{ indexable: true }], jobs: [{ isOpen: true }], projects: [{ indexable: true }] });
    const xml = await read(index());
    for (const s of ['blog', 'careers', 'projects']) expect(xml).toContain(`/sitemaps/${s}.xml`);
  });

  it('leaves out a switched-off blog, filled roles and noindex projects', async () => {
    Object.assign(state, { off: true, posts: [{ indexable: true }], jobs: [{ isOpen: false }], projects: [{ indexable: false }] });
    expect(await read(index())).not.toMatch(/blog\.xml|careers\.xml|projects\.xml/);
  });
});

describe('the careers sitemap', () => {
  it('is empty with no open role, not even the listing page', async () => {
    expect(await read(careers())).not.toContain('<loc>');
  });
});
