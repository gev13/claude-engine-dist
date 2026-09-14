import type { CategorySeed } from '@/content/posts';

/** Demo blog content: two categories and three posts, each with a cover image. */

export type DemoPost = {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  daysAgo: number;
  /** A name from `DEMO_IMAGES`. */
  cover: string;
  body: string;
};

export const demoCategories: CategorySeed[] = [
  { slug: 'studio-notes', name: 'Studio notes', description: 'What we are working on, and what we learned doing it.' },
  { slug: 'guides', name: 'Guides', description: 'Practical, step-by-step advice for teams building products.' },
];

export const demoPosts: DemoPost[] = [
  {
    slug: 'field-guide-to-small-product-teams',
    title: 'A field guide to small product teams',
    excerpt: 'Why four senior people usually beat fourteen, and how to set a small team up so it stays fast after launch.',
    categorySlug: 'guides',
    daysAgo: 4,
    cover: 'scene-dawn',
    body: `<p>Most of the products we admire were built by fewer people than you would guess. Small teams talk less and decide more, and nobody has to translate between them.</p>
<h2>Start with the decision, not the roadmap</h2>
<p>Before anything is designed, write down the one decision the product has to make easier. Everything that does not serve it waits.</p>
<h2>Keep the loop short</h2>
<ul><li>Ship something a real person can use every two weeks.</li><li>Watch them use it. Do not ask them what they think.</li><li>Change one thing at a time, so you know what worked.</li></ul>
<h2>Write it down once</h2>
<p>A single page that explains what the product is for, who it is for and what it will not do saves more meetings than any tool.</p>`,
  },
  {
    slug: 'what-we-learned-from-140-launches',
    title: 'What we learned from 140 launches',
    excerpt: 'Twelve years of launch days, condensed into the handful of habits that made the difference.',
    categorySlug: 'studio-notes',
    daysAgo: 18,
    cover: 'arch-facade',
    body: `<p>We keep a short note after every launch: what went well, what went wrong, and what we would do again. Here is what keeps coming up.</p>
<h2>The first week matters more than launch day</h2>
<p>Launch day is mostly theatre. The first week is when people decide whether to come back, so that is when the team should be watching closest.</p>
<h2>Boring technology ships</h2>
<p>The launches that went smoothly used tools the team already knew well. Novelty belongs in the product, not in the stack underneath it.</p>
<h2>Say what is not included</h2>
<p>Every launch note that listed what was deliberately left out generated fewer support tickets than the ones that did not.</p>`,
  },
  {
    slug: 'designing-products-people-can-repair',
    title: 'Designing products people can repair',
    excerpt: 'Screws instead of glue, parts you can order and manuals you can read: small choices that make a product last.',
    categorySlug: 'guides',
    daysAgo: 33,
    cover: 'product-bottle',
    body: `<p>A product that can be repaired is a product people keep. It is also, more often than not, a product that was designed with more care.</p>
<h2>Design the second owner in</h2>
<p>Assume the product will outlive its first owner. Standard fasteners, labelled parts and a published parts list cost little and change everything.</p>
<h2>Make the manual part of the product</h2>
<p>Clear instructions with real photographs turn a support call into a ten-minute fix at the kitchen table.</p>`,
  },
];
