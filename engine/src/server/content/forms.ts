import 'server-only';
import { type AnyBlock, blockSchemas } from '@/lib/blocks';
import { getPageByPath } from './pages';
import { getPopups } from './popups';

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
 * on the published page at `path`, or in a popup. The server checks answers
 * against this, never against anything the browser sends about the form.
 */
export async function findForm(path: string, id: string): Promise<FormProps | null> {
  const page = await getPageByPath(path);
  const onPage = page ? findIn(page.blocks, id) : null;
  if (onPage) return onPage;
  for (const popup of await getPopups()) {
    const hit = findIn(popup.blocks as unknown as AnyBlock[], id);
    if (hit) return hit;
  }
  return null;
}
