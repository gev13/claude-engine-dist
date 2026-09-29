'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminButton } from '@/components/admin/ui';

/* ═══════════════════════════════════════════════════════════════════════════
   What a published page tells search engines (3.20)
   ───────────────────────────────────────────────────────────────────────────
   Reads the page as a visitor gets it — same origin, so the admin can fetch
   it — and lists every node of its JSON-LD. The copy button is for the
   validators' "code snippet" mode, which works even when a validator cannot
   fetch the site itself (a firewall or bot protection in front of it).
   ═══════════════════════════════════════════════════════════════════════════ */

type Graph = { '@graph'?: Record<string, unknown>[] } & Record<string, unknown>;

/** Every JSON-LD script in an HTML document, parsed; unreadable ones are skipped. */
export function extractJsonLd(html: string): Graph[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: Graph[] = [];
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      out.push(JSON.parse(script.textContent ?? '') as Graph);
    } catch {
      /* not ours to fix here */
    }
  }
  return out;
}

/** The nodes' types, in order, for the summary line. */
export function nodeTypes(graphs: Graph[]): string[] {
  return graphs.flatMap((graph) => (graph['@graph'] ?? [graph]).map((node) => String(node['@type'] ?? '?')));
}

export function JsonLdPreview({ path, siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '' }: { path: string; siteUrl?: string }) {
  const [graphs, setGraphs] = useState<Graph[] | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setProblem('');
    try {
      const response = await fetch(path, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error(`The page answered ${response.status}.`);
      setGraphs(extractJsonLd(await response.text()));
    } catch (caught) {
      setGraphs(null);
      setProblem(caught instanceof Error ? caught.message : 'The page could not be read.');
    } finally {
      setBusy(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const combined = graphs
    ? JSON.stringify({ '@context': 'https://schema.org', '@graph': graphs.flatMap((graph) => graph['@graph'] ?? [graph]) }, null, 2)
    : '';
  const live = `${siteUrl.replace(/\/$/, '')}${path}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AdminButton type="button" variant="secondary" onClick={() => void load()} disabled={busy}>
          {busy ? 'Reading…' : 'Refresh'}
        </AdminButton>
        <AdminButton
          type="button"
          variant="secondary"
          disabled={!combined}
          onClick={() => {
            void navigator.clipboard?.writeText(`<script type="application/ld+json">\n${combined}\n</script>`).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy for a validator'}
        </AdminButton>
        <a className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft" href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(live)}`} target="_blank" rel="noopener noreferrer">
          Google test ↗
        </a>
        <a className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft" href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">
          Schema validator ↗
        </a>
      </div>
      {problem && <p className="m-0 text-[13px] text-flare-soft">{problem} Only a published page can be read.</p>}
      {graphs && (
        <>
          <p className="m-0 text-[13px] text-ash">
            {nodeTypes(graphs).length
              ? `As published: ${nodeTypes(graphs).join(' · ')}`
              : 'This page emits no structured data.'}
          </p>
          <pre className="m-0 max-h-[420px] overflow-auto border-2 border-hairline bg-ink p-3 font-mono text-[11px] leading-relaxed text-ash">{combined}</pre>
        </>
      )}
    </div>
  );
}
