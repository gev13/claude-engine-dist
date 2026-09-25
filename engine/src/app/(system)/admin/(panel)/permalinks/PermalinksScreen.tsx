'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import {
  POST_PATTERNS,
  POST_PATTERN_LABELS,
  blogIndexPath,
  categoryPath,
  pagedPath,
  postPath,
  withSlash,
  type Permalinks,
} from '@/lib/permalinks';
import { errorMessage, useUnsavedWarning } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Settings → Permalinks
   ───────────────────────────────────────────────────────────────────────────
   Every field shows the address it produces, with a real-looking example,
   because "category base" means nothing until you see `/category/news/`.
   A change on a site with posts is checked before it is saved: what collides,
   how many addresses move, and — the thing that matters on a live site — an
   offer to write a 301 from each old address to its new one.
   ═══════════════════════════════════════════════════════════════════════════ */

type Response = { permalinks: Permalinks };
type Check = { problems: string[]; moved: number; sample: { from: string; to: string }[] };

/** How an address will look under the mode being edited, not the one saved. */
const shown = (path: string, p: Permalinks) => withSlash(path, p.trailingSlash);

export function PermalinksScreen() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/permalinks', fetcher);

  const [form, setForm] = useState<Permalinks | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [createRedirects, setCreateRedirects] = useState(true);

  useEffect(() => {
    if (!data) return;
    setForm(data.permalinks);
    setSaved(JSON.stringify(data.permalinks));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  /* Ask the server what this change would do, a moment after typing stops. */
  useEffect(() => {
    if (!form || !dirty) {
      setCheck(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api<Check>('/api/admin/permalinks', { method: 'POST', json: { permalinks: form } })
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form, dirty]);

  const set = <K extends keyof Permalinks>(key: K, value: Permalinks[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!form) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response & { redirectsCreated: number }>('/api/admin/permalinks', {
        method: 'PUT',
        json: { permalinks: form, createRedirects: createRedirects && (check?.moved ?? 0) > 0 },
      });
      setForm(result.permalinks);
      setSaved(JSON.stringify(result.permalinks));
      await mutate({ permalinks: result.permalinks }, { revalidate: false });
      toast(
        result.redirectsCreated > 0
          ? `Saved, with ${result.redirectsCreated} redirect${result.redirectsCreated === 1 ? '' : 's'} from the old addresses.`
          : 'Saved. Every page has been revalidated.',
        'success',
      );
    } catch (caught) {
      const message = errorMessage(caught, 'The permalinks could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title="Permalinks" description="Where the blog lives, and what its addresses look like." />
        <Spinner />
      </>
    );
  }

  const example = { slug: 'hello-world', categorySlug: 'news' };

  return (
    <>
      <PageHeader
        title="Permalinks"
        description="Where the blog lives, and what its addresses look like."
        actions={
          <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty || (check?.problems.length ?? 0) > 0}>
            {busy ? 'Saving…' : 'Save'}
          </AdminButton>
        }
      />

      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Posts">
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">A post&rsquo;s address</legend>
            {POST_PATTERNS.map((pattern) => (
              <label key={pattern} className="flex cursor-pointer items-start gap-3 text-[14px] text-ash">
                <input
                  type="radio"
                  name="post-pattern"
                  className="mt-1 h-4 w-4 accent-flare"
                  checked={form.postPattern === pattern}
                  onChange={() => set('postPattern', pattern)}
                />
                <span>
                  <span className="block text-bone">{POST_PATTERN_LABELS[pattern].label}</span>
                  <code className="font-mono text-[12px] text-flare-soft">
                    {shown(postPath({ ...form, postPattern: pattern }, example), form)}
                  </code>
                </span>
              </label>
            ))}
          </fieldset>
          {form.postPattern === 'category' && (
            <p className="m-0 mt-4 text-[12px] leading-relaxed text-smoke">
              The post&rsquo;s primary category, or its first category when none is picked. A post with no category
              stays under the blog index. A post reached through another category&rsquo;s address is sent to its own.
            </p>
          )}
        </Panel>

        <Panel title="The blog and its archives">
          <div className="flex flex-col gap-5">
            <Field label="Blog index" htmlFor="pl-index" hint={`e.g. ${shown(blogIndexPath(form), form)}`}>
              <Input id="pl-index" value={form.blogIndex} onChange={(e) => set('blogIndex', e.target.value)} />
            </Field>
            <Field
              label="Category base"
              htmlFor="pl-category"
              hint={`a category lives at ${shown(categoryPath(form, 'news'), form)}`}
            >
              <Input id="pl-category" value={form.categoryBase} onChange={(e) => set('categoryBase', e.target.value)} />
            </Field>
            <Field
              label="Page word"
              htmlFor="pl-page"
              hint={`page 2 of the blog is ${shown(pagedPath(form.blogIndex, 2, form), form)}`}
            >
              <Input id="pl-page" value={form.pageSegment} onChange={(e) => set('pageSegment', e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Trailing slash">
          <Field
            label="Addresses end in /"
            htmlFor="pl-slash"
            hint={
              form.trailingSlash === 'always'
                ? 'every address the site writes ends in / — the other form answers with a 301'
                : 'no address ends in / — the other form answers with a redirect, as it always has'
            }
          >
            <Select
              id="pl-slash"
              value={form.trailingSlash}
              onChange={(e) => set('trailingSlash', e.target.value as Permalinks['trailingSlash'])}
            >
              <option value="never">Never — /about</option>
              <option value="always">Always — /about/</option>
            </Select>
          </Field>
          <p className="m-0 mt-4 text-[12px] leading-relaxed text-smoke">
            Links, canonicals, the sitemaps, breadcrumbs and structured data all follow this. Keep whatever the
            addresses already are — a site moving from WordPress usually wants <em>Always</em>.
          </p>
        </Panel>

        {dirty && check && (
          <Panel title="What this change does">
            <div className="flex flex-col gap-4">
              {check.problems.length > 0 ? (
                <Alert tone="error">
                  <ul className="m-0 pl-4">
                    {check.problems.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </Alert>
              ) : check.moved === 0 ? (
                <p className="m-0 text-[14px] text-ash">No published post or category changes address.</p>
              ) : (
                <>
                  <p className="m-0 text-[14px] text-ash">
                    {check.moved} address{check.moved === 1 ? '' : 'es'} will change, for example:
                  </p>
                  <ul className="m-0 flex flex-col gap-1 pl-0 font-mono text-[12px]">
                    {check.sample.map((move) => (
                      <li key={move.from} className="list-none text-smoke">
                        {move.from} <span className="text-flare-soft">→ {move.to}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2.5 text-[14px] text-ash">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-flare"
                      checked={createRedirects}
                      onChange={(e) => setCreateRedirects(e.target.checked)}
                    />
                    Create 301s from the old addresses
                  </label>
                  <p className="m-0 text-[12px] leading-relaxed text-smoke">
                    Recommended on any site that has been live: links elsewhere and search results keep working.
                    The redirects appear under Redirects, where they can be edited or removed.
                  </p>
                </>
              )}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
