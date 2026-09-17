'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SiteMark } from '@/components/ui/Logo';
import { api } from '@/lib/admin/client';
import { cn } from '@/lib/utils';
import type { Role } from '@/server/auth/rbac';

export type NavItem = { label: string; href: string; roles?: Role[]; exact?: boolean };

/** WordPress-shaped information architecture, per the specification. */
export const ADMIN_NAV: { section?: string; items: NavItem[] }[] = [
  { items: [{ label: 'Dashboard', href: '/admin', exact: true }] },
  {
    section: 'Content',
    items: [
      { label: 'Pages', href: '/admin/pages' },
      { label: 'Posts', href: '/admin/posts' },
      { label: 'Categories', href: '/admin/categories' },
      { label: 'Roles', href: '/admin/jobs' },
      { label: 'Media', href: '/admin/media' },
    ],
  },
  {
    section: 'Enquiries',
    items: [
      // An author writes; they do not handle the people who write back.
      { label: 'Contact enquiries', href: '/admin/enquiries', roles: ['admin', 'manager', 'editor', 'reviewer'] },
      { label: 'Newsletter sign-ups', href: '/admin/newsletter', roles: ['admin', 'manager', 'editor', 'reviewer'] },
      { label: 'Form submissions', href: '/admin/submissions', roles: ['admin', 'manager', 'editor', 'reviewer'] },
      // A CV is personal data, so this follows the three above rather than the
      // advert it answers. Must match `applications:read` in rbac.ts.
      { label: 'Applications', href: '/admin/applications', roles: ['admin', 'manager', 'editor', 'reviewer'] },
    ],
  },
  {
    section: 'Design',
    items: [
      // A manager owns the site's chrome — these must match rbac.ts, or the nav
      // hides something the role is allowed to do.
      { label: 'Appearance', href: '/admin/appearance', roles: ['admin', 'manager'] },
      { label: 'Menus', href: '/admin/navigation', roles: ['admin', 'manager'] },
      { label: 'Popups', href: '/admin/popups', roles: ['admin', 'manager'] },
      { label: 'Cookie notice', href: '/admin/cookies', roles: ['admin', 'manager'] },
      // `settings:*`, not `popups:*` — it loads on every page, like the theme.
      { label: 'Custom code', href: '/admin/code', roles: ['admin'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', roles: ['admin'] },
      { label: 'Redirects', href: '/admin/redirects', roles: ['admin', 'manager'] },
      { label: 'Email', href: '/admin/email', roles: ['admin'] },
      { label: 'Security', href: '/admin/security', roles: ['admin'] },
      { label: 'Updates', href: '/admin/updates', roles: ['admin'] },
      { label: 'Backups', href: '/admin/backups', roles: ['admin'] },
      { label: 'Export & import', href: '/admin/transfer', roles: ['admin'] },
      { label: 'Audit log', href: '/admin/audit', roles: ['admin'] },
      { label: 'Languages', href: '/admin/languages', roles: ['admin'] },
      { label: 'Site translations', href: '/admin/translations', roles: ['admin'] },
      { label: 'Settings', href: '/admin/settings', roles: ['admin'] },
      { label: 'Profile', href: '/admin/profile' },
    ],
  },
];

export function Sidebar({ role, name, siteName }: { role: Role; name: string; siteName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/admin/login';
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-4 top-4 z-50 border-2 border-hairline bg-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone lg:hidden"
        aria-expanded={open}
      >
        {open ? 'Close' : 'Menu'}
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r-2 border-hairline bg-surface transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 border-b-2 border-hairline px-5 py-4">
          <span className="h-8 w-7">
            <SiteMark />
          </span>
          <span className="truncate font-display text-[15px] font-extrabold tracking-[-0.01em]">{siteName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4" aria-label="Admin">
          {ADMIN_NAV.map((group, i) => {
            const items = group.items.filter((item) => !item.roles || item.roles.includes(role));
            if (items.length === 0) return null;
            return (
              <div key={group.section ?? i} className="mb-5">
                {group.section && (
                  <div className="px-5 pb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-smoke/70">
                    {group.section}
                  </div>
                )}
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 border-l-2 px-5 py-2.5 text-[14px] transition-colors',
                      isActive(item)
                        ? 'border-flare bg-ink text-bone'
                        : 'border-transparent text-ash hover:border-hairline hover:text-bone',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t-2 border-hairline px-5 py-4">
          <div className="truncate text-[13px] text-bone">{name}</div>
          <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-smoke">{role}</div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              target="_blank"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
            >
              View site ↗
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="cursor-pointer bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-ink/70 lg:hidden"
        />
      )}
    </>
  );
}
