import type { Metadata } from 'next';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { MediaLibrary } from './MediaLibrary';

export const metadata: Metadata = { title: 'Media' };
export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  // Picture sizes change every page's markup, so the panel is an administrator's (2.17).
  const user = await getSessionUser();
  return <MediaLibrary canSettings={user ? can(user, 'settings:write') : false} />;
}
