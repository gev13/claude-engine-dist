import 'server-only';
import { created, handle, notFound } from './respond';
import { requireUser } from './guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import type { Permission } from '@/server/auth/rbac';
import { duplicatePage, duplicatePost, duplicateProject, duplicateSavedBlock } from '@/server/content/duplicate';

type Kind = 'page' | 'post' | 'project' | 'savedBlock';

const RULES: Record<Kind, { permission: Permission; run: typeof duplicatePage | typeof duplicatePost | typeof duplicateProject | typeof duplicateSavedBlock; edit: string }> = {
  page: { permission: 'pages:write', run: duplicatePage, edit: '/admin/pages' },
  post: { permission: 'posts:write', run: duplicatePost, edit: '/admin/posts' },
  project: { permission: 'projects:write', run: duplicateProject, edit: '/admin/projects' },
  savedBlock: { permission: 'savedBlocks:write', run: duplicateSavedBlock, edit: '/admin/saved-blocks' },
};

/**
 * `POST …/[id]/duplicate` for one kind of content (T7). Anybody who may
 * create that kind may duplicate one — the copy is theirs, a draft, and
 * touches nothing of the original. Answers with the copy and where to edit it.
 */
export function duplicateHandler(kind: Kind) {
  return async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    return handle(async () => {
      const rule = RULES[kind];
      const guard = await requireUser(request, rule.permission);
      if (!guard.ok) return guard.response;
      const { id } = await ctx.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound('That does not exist.');
      const result = await rule.run(id, guard.user.id);
      if (!result) return notFound('That does not exist.');
      const copy = result.copy as { id: string };
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: `${kind}.duplicate`,
        targetType: kind,
        targetId: copy.id,
        summary: `Duplicated from "${result.from}"`,
        metadata: { from: id },
        ip: clientIp(request.headers),
      });
      return created({ ...result.copy, editUrl: `${rule.edit}/${copy.id}` });
    });
  };
}
