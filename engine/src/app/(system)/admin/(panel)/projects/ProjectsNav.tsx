'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** The three screens a portfolio is run from, as tabs across the top of each. */
const TABS = [
  { href: '/admin/projects', label: 'Projects', exact: true },
  { href: '/admin/projects/terms', label: 'Categories & tags' },
  { href: '/admin/projects/template', label: 'Page template' },
];

export function ProjectsNav({ canDesign = true }: { canDesign?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 border-b-2 border-hairline" aria-label="Projects">
      {TABS.filter((tab) => canDesign || tab.href !== '/admin/projects/template').map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-0.5 border-b-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
              active ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
