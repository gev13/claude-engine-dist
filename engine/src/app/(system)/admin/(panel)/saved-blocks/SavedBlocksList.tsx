'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { DuplicateButton } from '@/components/admin/DuplicateButton';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge, EmptyState, Input, Panel, Spinner, Table, Td, Th } from '@/components/admin/ui';
import { Wireframe } from '@/components/admin/Wireframe';
import { fetcher } from '@/lib/admin/client';
import type { AnyBlock, BlockType } from '@/lib/blocks';
import { formatDate } from '@/lib/utils';
import { BLOCK_WIREFRAMES } from '@/lib/wireframes';

type Row = {
  id: string;
  name: string;
  description: string;
  category: string;
  mode: 'synced' | 'template';
  tree: AnyBlock[];
  usage: number;
  updatedAt: string;
};

/**
 * My blocks (T8, 2.15): blocks designed once and used anywhere. They are made
 * from the builder — a block's ⋯ menu, "Save as a saved block" — and managed
 * here: renamed, edited, duplicated, and deleted once nothing uses them.
 */
export function SavedBlocksList() {
  const { data, isLoading } = useSWR<{ items: Row[] }>('/api/admin/saved-blocks', fetcher);
  const [query, setQuery] = useState('');
  const items = (data?.items ?? []).filter((row) =>
    `${row.name} ${row.description} ${row.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="My blocks"
        description="Blocks designed once and used on any page. Synced ones change everywhere at once; templates paste a copy."
      />
      <Panel>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved blocks…" aria-label="Search saved blocks" />
          </div>
          {isLoading && <Spinner />}
        </div>
        {items.length === 0 ? (
          <EmptyState
            title={query ? 'Nothing matches that.' : 'No saved blocks yet.'}
            body="In any page builder, open a block’s ⋯ menu and choose “Save as a saved block”. It then appears here and under Add block → My blocks."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Block</Th>
                <Th>Kind</Th>
                <Th>Folder</Th>
                <Th>Used</Th>
                <Th>Updated</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-[80px] shrink-0">
                        <Wireframe shapes={BLOCK_WIREFRAMES[(row.tree[0]?.type ?? 'savedBlock') as BlockType] ?? BLOCK_WIREFRAMES.savedBlock} />
                      </div>
                      <div>
                        <Link href={`/admin/saved-blocks/${row.id}`} className="text-bone hover:text-flare-soft">
                          {row.name}
                        </Link>
                        {row.description && <div className="mt-0.5 text-[12px] text-smoke">{row.description}</div>}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge>{row.mode === 'synced' ? 'synced' : 'template'}</Badge>
                  </Td>
                  <Td className="text-ash">{row.category || '—'}</Td>
                  <Td className="font-mono text-[12px] text-smoke">
                    {row.mode === 'synced' ? `${row.usage} place${row.usage === 1 ? '' : 's'}` : '—'}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">{formatDate(row.updatedAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <DuplicateButton kind="saved-blocks" id={row.id} compact />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
