import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { pagedPath } from '@/lib/permalinks';
import { messageReader } from '@/lib/messages';
import { projectItem, projectQueryString, type ProjectQuery } from '@/lib/projects';
import { getMessages } from '@/server/content/messages';
import { countProjects, listProjectCards } from '@/server/content/projects';
import type { Paging } from '@/server/content/resolve';
import { getPermalinks } from '@/server/routing/config';
import { Pagination } from '@/components/site/Pagination';
import { ProjectsBlock } from './showcase';

type Props = z.output<(typeof blockSchemas)['projects']> & {
  blockId?: string;
  /** The project whose page this block sits on, for `excludeCurrent`. */
  currentProjectId?: string;
  /** Which page this is, when the block pages on the server. */
  paging?: Paging;
};

/**
 * The projects block. A manual list renders as it always has; a collection
 * (T6, 2.14) is read from Projects here, on the server, so every card is in
 * the HTML — then handed to the same client grid, carousel and filters.
 */
export async function ProjectsSource(p: Props) {
  const { currentProjectId, paging, blockId: _blockId, ...block } = p;
  if (block.source !== 'collection') return <ProjectsBlock {...block} />;

  const [permalinks, messages] = await Promise.all([getPermalinks(), getMessages()]);
  const t = messageReader(messages);
  const query: ProjectQuery = {
    categories: block.categories,
    tags: block.tags,
    featuredOnly: block.featuredOnly,
    excludeId: block.excludeCurrent ? currentProjectId : undefined,
    order: block.order,
    limit: block.limit,
    offset: paging ? (paging.number - 1) * block.limit : 0,
  };
  const [cards, total] = await Promise.all([
    listProjectCards(query, permalinks),
    block.pagination === 'loadMore' ? countProjects(query) : Promise.resolve(0),
  ]);

  return (
    <>
      <ProjectsBlock
        {...block}
        // A carousel has no "more"; pages and load-more both need the grid.
        layout={block.layout === 'carousel' && block.pagination !== 'none' ? 'classic' : block.layout}
        items={cards.map(projectItem)}
        more={block.pagination === 'loadMore' ? { query: projectQueryString(query), total } : undefined}
      />
      {paging && block.pagination === 'pages' && (
        <div className="shell">
          <Pagination
            current={paging.number}
            total={paging.total}
            href={(n) => pagedPath(paging.base, n, permalinks)}
            labels={{
              nav: t('archive.pagination'),
              previous: t('archive.previousPage'),
              next: t('archive.nextPage'),
              page: (n) => t('archive.page', { n }),
              loadMore: t('archive.loadMore'),
              loading: t('archive.loading'),
            }}
          />
        </div>
      )}
    </>
  );
}
