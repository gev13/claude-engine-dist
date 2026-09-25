import Link from '@/components/ui/SiteLink';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import type { Locale } from '@/lib/locales';
import { categoryPath, projectTermPath } from '@/lib/permalinks';
import { cn } from '@/lib/utils';
import { listCategories } from '@/server/content/categories';
import { listProjectTerms } from '@/server/content/projects';
import { getPermalinks } from '@/server/routing/config';
import { BlockHead } from '../parts';
const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const toneClass = (tone?: keyof typeof TONES) => TONES[tone ?? 'base'];

type P = z.infer<(typeof blockSchemas)['categoryIndex']> & { locale?: Locale };

/**
 * 2.22 (GG2) — the blog's categories, or the projects', as numbered cards
 * with their descriptions, each linking to its archive. Read from the site
 * on every render, so a category added in the admin appears here without the
 * page being touched; with none, the block renders nothing.
 */
export async function CategoryIndexBlock(p: P) {
  const [permalinks, terms] = await Promise.all([
    getPermalinks(),
    p.source === 'projects' ? listProjectTerms('category', p.locale) : listCategories(p.locale),
  ]);
  const items = terms.slice(0, p.limit).map((term) => ({
    key: term.slug,
    name: term.name,
    description: term.description,
    href: p.source === 'projects' ? projectTermPath(permalinks, 'category', term.slug) : categoryPath(permalinks, term.slug),
  }));
  if (items.length === 0) return null;

  return (
    <section className={cn('he-lsec he-catidx-sec', toneClass(p.tone))}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
        <ul className="he-catidx" style={{ '--cols': p.columns } as React.CSSProperties}>
          {items.map((item, i) => (
            <li key={item.key}>
              <Link href={item.href} className="he-catidx__card">
                {p.numbered && <span className="he-catidx__num">{String(i + 1).padStart(2, '0')}</span>}
                <h3 className="he-catidx__name">{item.name}</h3>
                {p.descriptions && item.description && <p className="he-catidx__desc">{item.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
