'use client';

import { freshIds } from '@/lib/blockTree';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { nanoid } from 'nanoid';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import type { AnyBlock } from '@/lib/blocks';
import { POPUP_POSITIONS, POPUP_POSITION_LABELS, type Popup } from '@/lib/popups';
import { cn } from '@/lib/utils';

type Response = { popups: Popup[] };

/** A new popup starts switched off, so nothing appears on the site until it is ready. */
function blankPopup(taken: string[]): Popup {
  let n = taken.length + 1;
  while (taken.includes(`popup-${n}`)) n++;
  return {
    id: nanoid(10),
    name: `Popup ${n}`,
    slug: `popup-${n}`,
    enabled: false,
    blocks: [
      { id: nanoid(10), type: 'heading', props: { title: 'A short headline', align: 'center', size: 'medium' } },
      { id: nanoid(10), type: 'buttons', props: { align: 'center', items: [{ label: 'Find out more', href: '/contact', style: 'primary' }] } },
    ],
    position: 'center',
    size: 'medium',
    trigger: 'delay',
    delay: 5,
    scroll: 50,
    frequency: 'session',
    days: 7,
    pages: 'all',
    paths: [],
    devices: 'all',
    overlay: true,
  };
}

const TRIGGER_TEXT: Record<Popup['trigger'], string> = {
  delay: 'after a delay',
  exit: 'when the pointer leaves the window',
  scroll: 'after scrolling',
  click: 'only from a link',
};

export function PopupsScreen() {
  return (
    <ToastProvider>
      <PopupsScreenInner />
    </ToastProvider>
  );
}

function PopupsScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/popups', fetcher);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState('[]');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPopups(data.popups);
    setSaved(JSON.stringify(data.popups));
  }, [data]);

  const dirty = JSON.stringify(popups) !== saved;
  const current = popups[selected];
  const update = (patch: Partial<Popup>) => setPopups((list) => list.map((p, i) => (i === selected ? { ...p, ...patch } : p)));

  async function save() {
    setSaving(true);
    try {
      const result = await api<Response>('/api/admin/popups', { method: 'PUT', json: { popups } });
      await mutate(result, { revalidate: false });
      toast('Popups saved. Every page has been revalidated.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the popups.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function add() {
    if (popups.length >= 10) return toast('A site can have up to ten popups.', 'error');
    setPopups((list) => [...list, blankPopup(list.map((p) => p.slug))]);
    setSelected(popups.length);
  }

  /** T7 — a switched-off copy with its own name, link name and block ids, saved with the rest. */
  function duplicate() {
    if (!current) return;
    if (popups.length >= 10) return toast('A site can have up to ten popups.', 'error');
    const taken = popups.map((p) => p.slug);
    let slug = `${current.slug.slice(0, 32)}-copy`;
    for (let n = 2; taken.includes(slug); n++) slug = `${current.slug.slice(0, 32)}-copy-${n}`;
    const copy = {
      ...structuredClone(current),
      id: nanoid(10),
      name: `${current.name} (copy)`.slice(0, 80),
      slug,
      enabled: false,
      blocks: freshIds(current.blocks as unknown as AnyBlock[], () => nanoid(10), { renameForms: true }) as unknown as typeof current.blocks,
    };
    setPopups((list) => [...list, copy]);
    setSelected(popups.length);
    toast('Copied — switched off until you turn it on. Save to keep it.', 'success');
  }

  function remove() {
    if (!current || !window.confirm(`Delete “${current.name}”? It is removed when you save.`)) return;
    setPopups((list) => list.filter((_, i) => i !== selected));
    setSelected(0);
  }

  if (isLoading && !data) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Popups"
        description="Content built from blocks that appears over the site — after a delay, on the way out, after some scrolling, or from a link to #popup-name."
        actions={
          <>
            <AdminButton variant="secondary" type="button" onClick={add}>
              Add popup
            </AdminButton>
            <AdminButton type="button" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : dirty ? 'Save popups' : 'Saved'}
            </AdminButton>
          </>
        }
      />

      {popups.length === 0 ? (
        <Panel title="No popups yet">
          <p className="m-0 text-[14px] text-ash">Add one to build its content and choose when it appears. A new popup starts switched off.</p>
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Popups" className="flex flex-col gap-2">
            {popups.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(i)}
                aria-current={i === selected ? 'true' : undefined}
                className={cn('border-2 px-3 py-2.5 text-left transition-colors', i === selected ? 'border-flare' : 'border-hairline hover:border-rule')}
              >
                <span className="block text-[14px] text-bone">{p.name}</span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-smoke">
                  {p.enabled ? 'On' : 'Off'} · {TRIGGER_TEXT[p.trigger]}
                </span>
              </button>
            ))}
          </nav>

          {current && (
            <div className="flex flex-col gap-6">
              <Panel title="Popup">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" hint="also read out when it opens">
                    <Input value={current.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Link name" hint={`a link to #popup-${current.slug || 'name'} opens it`}>
                    <Input
                      value={current.slug}
                      maxLength={40}
                      spellCheck={false}
                      onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <label className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="checkbox" className="h-4 w-4 accent-flare" checked={current.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
                    Switched on
                  </label>
                  <div className="flex gap-2">
                    <AdminButton variant="ghost" type="button" onClick={duplicate}>
                      Duplicate
                    </AdminButton>
                    <AdminButton variant="ghost" type="button" className="text-flare-soft" onClick={remove}>
                      Delete this popup
                    </AdminButton>
                  </div>
                </div>
              </Panel>

              <Panel title="Where it sits">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Position">
                    <Select value={current.position} onChange={(e) => update({ position: e.target.value as Popup['position'] })}>
                      {POPUP_POSITIONS.map((position) => (
                        <option key={position} value={position}>
                          {POPUP_POSITION_LABELS[position]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Size">
                    <Select value={current.size} onChange={(e) => update({ size: e.target.value as Popup['size'] })}>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </Select>
                  </Field>
                  {current.position === 'center' && (
                    <label className="flex items-end gap-2 pb-3 text-[14px] text-ash">
                      <input type="checkbox" className="h-4 w-4 accent-flare" checked={current.overlay} onChange={(e) => update({ overlay: e.target.checked })} />
                      Dim the page behind it
                    </label>
                  )}
                </div>
              </Panel>

              <Panel title="When it opens">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Opens">
                    <Select value={current.trigger} onChange={(e) => update({ trigger: e.target.value as Popup['trigger'] })}>
                      <option value="delay">After a delay</option>
                      <option value="exit">When the pointer leaves the window (not on phones)</option>
                      <option value="scroll">After scrolling part of the page</option>
                      <option value="click">Only from a link</option>
                    </Select>
                  </Field>
                  {current.trigger === 'delay' && (
                    <Field label="Seconds after the page opens">
                      <Input type="number" min={0} max={120} value={current.delay} onChange={(e) => update({ delay: Math.min(120, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />
                    </Field>
                  )}
                  {current.trigger === 'scroll' && (
                    <Field label="Per cent of the page">
                      <Input type="number" min={5} max={100} value={current.scroll} onChange={(e) => update({ scroll: Math.min(100, Math.max(5, Math.round(Number(e.target.value) || 5))) })} />
                    </Field>
                  )}
                  {current.trigger !== 'click' && (
                    <Field label="How often">
                      <Select value={current.frequency} onChange={(e) => update({ frequency: e.target.value as Popup['frequency'] })}>
                        <option value="always">Every time</option>
                        <option value="session">Once a visit</option>
                        <option value="days">Again after some days</option>
                      </Select>
                    </Field>
                  )}
                  {current.trigger !== 'click' && current.frequency === 'days' && (
                    <Field label="Days before it shows again">
                      <Input type="number" min={1} max={365} value={current.days} onChange={(e) => update({ days: Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
                    </Field>
                  )}
                </div>
                <p className="m-0 mt-3 text-[12px] text-smoke">A link to #popup-{current.slug} opens it whatever is set here.</p>
              </Panel>

              {current.trigger !== 'click' && (
                <Panel title="Where it opens">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pages">
                      <Select value={current.pages} onChange={(e) => update({ pages: e.target.value as Popup['pages'] })}>
                        <option value="all">Every page</option>
                        <option value="only">Only these pages</option>
                        <option value="except">Every page except these</option>
                      </Select>
                    </Field>
                    <Field label="Devices">
                      <Select value={current.devices} onChange={(e) => update({ devices: e.target.value as Popup['devices'] })}>
                        <option value="all">Every screen</option>
                        <option value="desktop">Wider than a phone</option>
                        <option value="mobile">Phones only</option>
                      </Select>
                    </Field>
                  </div>
                  {current.pages !== 'all' && (
                    <Field label="Pages, one per line" hint="/pricing is one page; /blog/* is the blog and everything in it" className="mt-4">
                      <Textarea
                        rows={4}
                        spellCheck={false}
                        value={current.paths.join('\n')}
                        onChange={(e) => update({ paths: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 20) })}
                      />
                    </Field>
                  )}
                </Panel>
              )}

              <Panel title="Content">
                <p className="m-0 mb-4 text-[13px] text-smoke">Built from the same blocks as a page, without their tall section padding. Keep it short.</p>
                <BlockBuilder value={current.blocks as unknown as AnyBlock[]} onChange={(blocks) => update({ blocks: blocks as unknown as Popup['blocks'] })} />
              </Panel>
            </div>
          )}
        </div>
      )}
    </>
  );
}
