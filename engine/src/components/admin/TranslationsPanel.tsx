'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Panel } from '@/components/admin/ui';
import { fetcher } from '@/lib/admin/client';
import { localeName } from '@/lib/locales';

/* ═══════════════════════════════════════════════════════════════════════════
   Which languages a page exists in
   ───────────────────────────────────────────────────────────────────────────
   Self-contained on purpose: it asks the translations endpoint rather than
   having the configured languages threaded down through the editor, so the
   editor keeps knowing nothing about locales.

   It renders nothing at all on a single-language site — there is no such thing
   as a translation when there is one language.
   ═══════════════════════════════════════════════════════════════════════════ */

type Language = {
  locale: string;
  id: string | null;
  status: string | null;
  progress: { total: number; translated: number; remaining: number };
};

export function TranslationsPanel({
  pageId,
  kind = 'page',
}: {
  pageId: string;
  kind?: 'page' | 'post' | 'category';
}) {
  const { data } = useSWR<{ languages: Language[] }>(
    `/api/admin/translations?id=${encodeURIComponent(pageId)}&kind=${kind}`,
    fetcher,
  );

  if (!data || data.languages.length === 0) return null;

  return (
    <Panel title="Translations">
      <div className="flex flex-col">
        {data.languages.map((language) => {
          const done = language.id && language.progress.remaining === 0;
          return (
            <Link
              key={language.locale}
              href={`/admin/${kind === 'category' ? 'categories' : `${kind}s`}/${pageId}/translate/${language.locale}`}
              className="flex items-center justify-between gap-3 border-b-2 border-hairline py-2.5 last:border-b-0 hover:text-bone"
            >
              <span className="text-[14px] text-ash">{localeName(language.locale)}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
                {!language.id
                  ? 'not started'
                  : done
                    ? language.status === 'published'
                      ? 'complete'
                      : 'complete · draft'
                    : `${language.progress.translated}/${language.progress.total}`}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="m-0 mt-3 text-[13px] leading-relaxed text-smoke">
        A translation keeps this {kind}&rsquo;s layout and pictures; only the words differ. Change the layout here and
        every language follows.
      </p>
    </Panel>
  );
}
