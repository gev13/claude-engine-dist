/**
 * Bundled blog content.
 *
 * A new site starts with none: the seed writes whatever is listed here, and an
 * empty list means an empty blog that an editor fills from the admin. The types
 * stay so `npm run db:seed` keeps compiling.
 */
export type CategorySeed = { slug: string; name: string; description: string };

export type PostSeed = {
  slug: string;
  title: string;
  excerpt: string;
  kind: 'article' | 'research';
  categorySlug: string;
  daysAgo: number;
  body: string;
};

export const categorySeeds: CategorySeed[] = [];

export const postSeeds: PostSeed[] = [];
