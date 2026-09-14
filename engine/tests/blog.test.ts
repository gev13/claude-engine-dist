import { describe, expect, it } from 'vitest';
import { blogSchema, resolveBlog } from '../src/lib/blog';
import { parseTheme, themeSchema } from '../src/lib/theme';

describe('blog layouts (BL1, BL2)', () => {
  it('keeps the card grid and the standard post when nothing is saved', () => {
    expect(resolveBlog(undefined)).toEqual({ index: 'grid', pagination: 'none', perPage: 9, post: 'standard', progress: false });
  });

  it('is part of the theme, checked at the boundary', () => {
    expect(parseTheme({ blog: { index: 'wide', post: 'split' } }).blog).toEqual({ index: 'wide', post: 'split' });
    expect(themeSchema.safeParse({ blog: { index: 'masonry' } }).success).toBe(false);
    expect(themeSchema.safeParse({ blog: { post: 'magazine' } }).success).toBe(false);
  });

  it('keeps a page of posts between 2 and 24', () => {
    expect(blogSchema.safeParse({ perPage: 1 }).success).toBe(false);
    expect(blogSchema.safeParse({ perPage: 25 }).success).toBe(false);
    expect(blogSchema.safeParse({ perPage: 6, pagination: 'pages' }).success).toBe(true);
  });
});
