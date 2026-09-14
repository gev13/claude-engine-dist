import { getSessionUser } from '@/server/auth/session';
import { PERMISSIONS, type Permission } from '@/server/auth/rbac';
import { handle, ok, unauthorized } from '@/server/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Who am I, and what may I do. The admin client uses this to shape its UI. */
export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
      (PERMISSIONS[p] as readonly string[]).includes(user.role),
    );

    return ok({ user, permissions });
  });
}
