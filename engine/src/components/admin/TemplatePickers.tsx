'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Alert, Spinner } from '@/components/admin/ui';
import { api, fetcher } from '@/lib/admin/client';
import type { AnyBlock, BlockType } from '@/lib/blocks';
import { BLOCK_WIREFRAMES } from '@/lib/wireframes';
import { Wireframe } from './Wireframe';

/* ═══════════════════════════════════════════════════════════════════════════
   P3-G — the two template pickers: whole pages (new page) and ready
   sections (Add block). Both ask /api/admin/templates for the blocks, which
   arrive with fresh ids and with their demo pictures in the media library.
   ═══════════════════════════════════════════════════════════════════════════ */

type Summary = { id: string; name: string; description: string; types: string[] };
type TemplateList = { pages: (Summary & { category: string })[]; sections: (Summary & { group: string })[] };
export type PickedTemplate = { blocks: AnyBlock[]; page?: { title: string; excerpt: string } };

const LIST_URL = '/api/admin/templates';

/** The first few blocks' wireframes stacked, like a page seen from far away. */
function WireStack({ types, max }: { types: string[]; max: number }) {
  const shown = types.filter((type): type is BlockType => type in BLOCK_WIREFRAMES).slice(0, max);
  return (
    <span className="flex flex-col gap-1" aria-hidden="true">
      {shown.map((type, i) => (
        <Wireframe key={`${type}-${i}`} shapes={BLOCK_WIREFRAMES[type]} />
      ))}
    </span>
  );
}

function usePick(kind: 'page' | 'section', onPick: (picked: PickedTemplate) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  async function pick(id: string) {
    setBusy(id);
    setProblem('');
    try {
      onPick(await api<PickedTemplate>(LIST_URL, { json: { kind, id } }));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That template could not be loaded.');
    } finally {
      setBusy(null);
    }
  }
  return { busy, problem, pick };
}

const CARD = 'group flex cursor-pointer flex-col border-2 border-hairline bg-ink p-2 text-left transition-colors hover:border-flare focus-visible:border-flare disabled:cursor-wait disabled:opacity-60';

/** Shown on a new, empty page: start from one of the page templates. */
export function PageTemplatePicker({ onPick }: { onPick: (picked: PickedTemplate) => void }) {
  const { data, error, isLoading } = useSWR<TemplateList>(LIST_URL, fetcher);
  const { busy, problem, pick } = usePick('page', onPick);

  if (isLoading) return <Spinner label="Loading templates" />;
  if (error || !data) return <Alert tone="error">The templates could not be loaded. Reload the page to try again.</Alert>;

  return (
    <div>
      <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
        Start from a ready-made page: it arrives as ordinary blocks with sample text and pictures to replace with your own. Or skip this and add blocks one by one below.
      </p>
      {problem && (
        <div className="mb-4">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {data.pages.map((template) => (
          <button key={template.id} type="button" disabled={busy !== null} onClick={() => void pick(template.id)} className={CARD}>
            <WireStack types={template.types} max={3} />
            <span className="mt-2 block text-[13px] text-bone">{template.name}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-smoke">{busy === template.id ? 'Adding…' : template.category}</span>
            <span className="mt-1 block text-[12px] leading-snug text-ash">{template.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Inside Add block: a few blocks that belong together, already filled in. */
export function ReadySections({ onInsert }: { onInsert: (blocks: AnyBlock[]) => void }) {
  const { data, error, isLoading } = useSWR<TemplateList>(LIST_URL, fetcher);
  const { busy, problem, pick } = usePick('section', (picked) => onInsert(picked.blocks));

  if (isLoading) return <Spinner label="Loading sections" />;
  if (error || !data) return <Alert tone="error">The ready sections could not be loaded.</Alert>;

  const groups = [...new Set(data.sections.map((section) => section.group))];
  return (
    <div className="flex flex-col gap-6">
      {problem && <Alert tone="error">{problem}</Alert>}
      {groups.map((group) => (
        <section key={group}>
          <h3 className="m-0 mb-2 font-mono text-[9px] font-normal uppercase tracking-[0.16em] text-smoke/70">{group}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.sections
              .filter((section) => section.group === group)
              .map((section) => (
                <button key={section.id} type="button" disabled={busy !== null} onClick={() => void pick(section.id)} className={CARD}>
                  <WireStack types={section.types} max={2} />
                  <span className="mt-2 block text-[12px] leading-snug text-bone">{busy === section.id ? 'Adding…' : section.name}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-smoke">{section.description}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
