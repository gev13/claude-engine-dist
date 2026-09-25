import 'server-only';
import { type AnyBlock, blockSchemas } from '@/lib/blocks';
import { localeConfig, splitLocale } from '@/lib/locales';
import { getPopups } from './popups';
import { resolvePath } from './resolve';
import { expandSavedBlocks } from './savedBlocks';

type FormProps = ReturnType<(typeof blockSchemas)['form']['parse']>;

/** A form block with this id, anywhere in a list of blocks, including inside rows. */
function findIn(blocks: AnyBlock[], id: string): FormProps | null {
  for (const block of blocks) {
    if (block?.id === id && block.type === 'form') {
      const parsed = blockSchemas.form.safeParse(block.props ?? {});
      return parsed.success ? parsed.data : null;
    }
    if (block?.type === 'row') {
      for (const column of (block.props?.columns ?? []) as { blocks?: AnyBlock[] }[]) {
        const hit = findIn(column.blocks ?? [], id);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/**
 * The form a submission claims to come from, as it is saved on the site:
 * on the published page or post at `path`, or in a popup. The server checks
 * answers against this, never against anything the browser sends about the
 * form.
 *
 * `path` is what the browser was showing, so it may carry a language prefix
 * and a trailing slash; both are taken off, and the address is resolved the
 * way the site resolves it — which is how a form inside a post's blocks is
 * found (2.13), wherever the permalinks put that post.
 */
export async function findForm(path: string, id: string): Promise<FormProps | null> {
  const { locale, rest } = splitLocale(path.split('?')[0] ?? '/', localeConfig());
  const resolved = await resolvePath(rest, locale);
  const blocks =
    resolved?.kind === 'page'
      ? resolved.page.blocks
      : resolved?.kind === 'post' && resolved.post.layout !== 'body'
        ? resolved.post.blocks
        : resolved?.kind === 'blogIndex'
          ? (resolved.page?.blocks ?? [])
          : [];
  // A form inside a synced saved block is on the page too (2.15).
  const onPage = findIn(await expandSavedBlocks(blocks, locale), id);
  if (onPage) return onPage;
  for (const popup of await getPopups()) {
    const hit = findIn(await expandSavedBlocks(popup.blocks as unknown as AnyBlock[], locale), id);
    if (hit) return hit;
  }
  return null;
}
