'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { nanoid } from 'nanoid';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  type FooterColumn,
  type NavChild,
  type NavItem,
  SOCIAL_SHORT,
  type SocialLabelStyle,
  type SocialLink,
  isSafeHref,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

type Cta = { label: string; href: string };

type Resolved = {
  header: NavItem[];
  /** Null when there is no header button. */
  headerCta: Cta | null;
  headerSecondaryCta: Cta | null;
  footer: FooterColumn[];
  footerNote?: string;
  footerAddress?: string;
  social: SocialLink[];
  socialStyle?: SocialLabelStyle;
  fallback: boolean;
};

const EMPTY_CTA: Cta = { label: '', href: '' };
type Response = { navigation: Resolved; bundled: unknown };
type PageRow = { id: string; title: string; path: string; status: string };

const newId = () => nanoid(10);

export function NavigationScreen() {
  return (
    <ToastProvider>
      <NavigationScreenInner />
    </ToastProvider>
  );
}

function NavigationScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/navigation', fetcher);
  const { data: pages } = useSWR<{ items: PageRow[] }>('/api/admin/pages?perPage=100', fetcher);

  const [header, setHeader] = useState<NavItem[]>([]);
  const [cta, setCta] = useState<Cta>(EMPTY_CTA);
  const [secondary, setSecondary] = useState<Cta>(EMPTY_CTA);
  const [footer, setFooter] = useState<FooterColumn[]>([]);
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [social, setSocial] = useState<SocialLink[]>([]);
  const [socialStyle, setSocialStyle] = useState<SocialLabelStyle>('icon');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'header' | 'footer'>('header');

  const snapshot = (s: { h: NavItem[]; c: Cta; s2: Cta; f: FooterColumn[]; n: string; a: string; so: SocialLink[]; ss: SocialLabelStyle }) =>
    JSON.stringify(s);

  useEffect(() => {
    if (!data) return;
    const n = data.navigation;
    // No button is edited as two empty fields; compare against the same shape
    // so an untouched screen does not read as unsaved.
    const c = n.headerCta ?? EMPTY_CTA;
    const s2 = n.headerSecondaryCta ?? EMPTY_CTA;
    setHeader(n.header);
    setCta(c);
    setSecondary(s2);
    setFooter(n.footer);
    setNote(n.footerNote ?? '');
    setAddress(n.footerAddress ?? '');
    setSocial(n.social ?? []);
    setSocialStyle(n.socialStyle ?? 'icon');
    setSaved(snapshot({ h: n.header, c, s2, f: n.footer, n: n.footerNote ?? '', a: n.footerAddress ?? '', so: n.social ?? [], ss: n.socialStyle ?? 'icon' }));
  }, [data]);

  const dirty = snapshot({ h: header, c: cta, s2: secondary, f: footer, n: note, a: address, so: social, ss: socialStyle }) !== saved;

  async function save() {
    const pair = (value: Cta, name: string) => {
      const label = value.label.trim();
      const href = value.href.trim();
      if (Boolean(label) !== Boolean(href)) {
        toast(`The ${name} needs both a label and a link — or clear both for no button.`, 'error');
        return null;
      }
      return label && href ? { label, href } : undefined;
    };
    const first = pair(cta, 'call to action');
    const second = pair(secondary, 'second button');
    if (first === null || second === null) return;

    const badSocial = social.find((s) => !isSafeHref(s.href));
    if (badSocial) {
      toast(`The ${SOCIAL_LABELS[badSocial.network]} link needs a full https:// address — or mailto: / tel: for email and phone.`, 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        header,
        // Both empty means no button: the key is left out rather than sent blank.
        ...(first ? { headerCta: first } : {}),
        ...(second ? { headerSecondaryCta: second } : {}),
        footer,
        ...(note.trim() ? { footerNote: note.trim() } : {}),
        ...(address.trim() ? { footerAddress: address.trim() } : {}),
        ...(social.length ? { social } : {}),
        // Icons are the default and are left out, so an untouched site saves what it always did.
        ...(socialStyle !== 'icon' ? { socialStyle } : {}),
      };
      const result = await api<Response>('/api/admin/navigation', { method: 'PUT', json: body });
      await mutate(result, { revalidate: false });
      toast('Menus saved. Every page has been revalidated.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the menus.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm('Reset both menus to the built-in navigation? This cannot be undone.')) return;
    setSaving(true);
    try {
      const result = await api<Response>('/api/admin/navigation', { method: 'DELETE' });
      await mutate(result, { revalidate: false });
      toast('Menus reset to the built-in navigation.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not reset the menus.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Menus"
        description="The header and footer navigation. Changes apply to every page on the site."
        actions={
          <>
            <AdminButton variant="ghost" onClick={reset} disabled={saving}>
              Reset to default
            </AdminButton>
            <AdminButton onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : dirty ? 'Save menus' : 'Saved'}
            </AdminButton>
          </>
        }
      />

      {isLoading && <Spinner label="Loading the menus" />}

      {data?.navigation.fallback && (
        <div className="mb-5">
          <Alert tone="info">
            These are the built-in menus that ship with the site. Saving stores an editable copy in the database.
          </Alert>
        </div>
      )}

      <nav className="mb-6 flex gap-1 border-b-2 border-hairline">
        {(['header', 'footer'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              '-mb-0.5 border-b-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
              tab === t ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
            )}
          >
            {t === 'header' ? 'Header menu' : 'Footer menu'}
          </button>
        ))}
      </nav>

      {tab === 'header' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Panel title="Header menu">
            <ItemList
              items={header}
              onChange={setHeader}
              pages={pages?.items ?? []}
              allowChildren
            />
          </Panel>

          <div className="space-y-6">
            <Panel title="Call to action">
              <p className="m-0 mb-4 text-[12px] text-smoke">
                The filled button at the end of the header. Leave both fields empty for no button.
              </p>
              <Field label="Label">
                <Input value={cta.label} onChange={(e) => setCta({ ...cta, label: e.target.value })} />
              </Field>
              <div className="mt-4">
                <HrefField value={cta.href} onChange={(href) => setCta({ ...cta, href })} pages={pages?.items ?? []} />
              </div>
            </Panel>

            <Panel title="Second button">
              <p className="m-0 mb-4 text-[12px] text-smoke">A quieter link beside it, such as &ldquo;Log in&rdquo;.</p>
              <Field label="Label">
                <Input value={secondary.label} onChange={(e) => setSecondary({ ...secondary, label: e.target.value })} />
              </Field>
              <div className="mt-4">
                <HrefField value={secondary.href} onChange={(href) => setSecondary({ ...secondary, href })} pages={pages?.items ?? []} />
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Panel
            title="Footer columns"
            actions={
              <AdminButton
                variant="ghost"
                onClick={() =>
                  setFooter([...footer, { id: newId(), title: 'New column', placement: 'main', items: [] }])
                }
              >
                + Add column
              </AdminButton>
            }
          >
            <div className="space-y-4">
              {footer.length === 0 && <p className="m-0 text-[13px] text-smoke">No columns yet.</p>}
              {footer.map((column, ci) => (
                <div key={column.id} className="border-2 border-hairline bg-ink p-4">
                  <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                    <Field label="Column title">
                      <Input
                        value={column.title}
                        onChange={(e) =>
                          setFooter(footer.map((c, i) => (i === ci ? { ...c, title: e.target.value } : c)))
                        }
                      />
                    </Field>
                    <Field label="Placement" hint="legal sits in the bottom bar">
                      <Select
                        value={column.placement ?? 'main'}
                        onChange={(e) =>
                          setFooter(
                            footer.map((c, i) =>
                              i === ci ? { ...c, placement: e.target.value as 'main' | 'legal' } : c,
                            ),
                          )
                        }
                      >
                        <option value="main">Main column</option>
                        <option value="legal">Bottom bar</option>
                      </Select>
                    </Field>
                    <div className="flex items-end gap-1 pb-1">
                      <AdminButton
                        variant="ghost"
                        onClick={() => setFooter(swap(footer, ci, ci - 1))}
                        disabled={ci === 0}
                        className="px-2 py-1"
                        aria-label="Move column up"
                      >
                        ↑
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        onClick={() => setFooter(swap(footer, ci, ci + 1))}
                        disabled={ci === footer.length - 1}
                        className="px-2 py-1"
                        aria-label="Move column down"
                      >
                        ↓
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        onClick={() => setFooter(footer.filter((_, i) => i !== ci))}
                        className="px-2 py-1 text-flare-soft"
                        aria-label="Remove column"
                      >
                        ×
                      </AdminButton>
                    </div>
                  </div>

                  <ItemList
                    items={column.items as NavItem[]}
                    onChange={(items) => setFooter(footer.map((c, i) => (i === ci ? { ...c, items } : c)))}
                    pages={pages?.items ?? []}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Bottom bar">
            <Field label="Copyright line" hint="leave empty for the automatic © year line">
              <Input value={note} placeholder="© 2026 Site name" onChange={(e) => setNote(e.target.value)} />
            </Field>
          </Panel>

          <Panel title="Address">
            <Field label="Postal address" hint="shown by the brand-block footer; line breaks are kept">
              <Textarea rows={3} value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          </Panel>

          <Panel
            title="Social links"
            actions={
              <AdminButton variant="ghost" onClick={() => setSocial([...social, { network: 'linkedin', href: '' }])}>
                + Add link
              </AdminButton>
            }
          >
            {social.length === 0 && <p className="m-0 text-[13px] text-smoke">No social links yet.</p>}
            <Field label="Show them as" className="mb-4 max-w-[320px]" hint="in the header menu and the footer; the Social links block has its own">
              <Select value={socialStyle} onChange={(e) => setSocialStyle(e.target.value as SocialLabelStyle)}>
                <option value="icon">Icons</option>
                <option value="name">Names — Instagram, Behance</option>
                <option value="short">Short labels — Ig. / Be.</option>
              </Select>
            </Field>
            <div className="space-y-2">
              {social.map((link, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_90px_auto]">
                  <Select
                    value={link.network}
                    onChange={(e) =>
                      setSocial(social.map((s, j) => (j === i ? { ...s, network: e.target.value as SocialLink['network'] } : s)))
                    }
                  >
                    {SOCIAL_NETWORKS.map((network) => (
                      <option key={network} value={network}>
                        {SOCIAL_LABELS[network]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={link.href}
                    placeholder={link.network === 'email' ? 'mailto:hello@example.com' : link.network === 'phone' ? 'tel:+441234567890' : 'https://'}
                    spellCheck={false}
                    onChange={(e) => setSocial(social.map((s, j) => (j === i ? { ...s, href: e.target.value.trim() } : s)))}
                  />
                  <Input
                    value={link.short ?? ''}
                    placeholder={SOCIAL_SHORT[link.network]}
                    maxLength={8}
                    aria-label={`Short label for ${SOCIAL_LABELS[link.network]}`}
                    onChange={(e) => setSocial(social.map((s, j) => (j === i ? { ...s, short: e.target.value.trim() || undefined } : s)))}
                  />
                  <AdminButton
                    variant="ghost"
                    onClick={() => setSocial(social.filter((_, j) => j !== i))}
                    className="px-2 py-1 text-flare-soft"
                    aria-label={`Remove ${SOCIAL_LABELS[link.network]}`}
                  >
                    ×
                  </AdminButton>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

function swap<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** One editable menu, with optional one-level children. */
function ItemList({
  items,
  onChange,
  pages,
  allowChildren = false,
}: {
  items: NavItem[];
  onChange: (next: NavItem[]) => void;
  pages: PageRow[];
  allowChildren?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const set = (i: number, patch: Partial<NavItem>) =>
    onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="m-0 py-2 text-[13px] text-smoke">No items yet.</p>}

      {items.map((item, i) => (
        <div key={item.id} className="border-2 border-hairline bg-surface">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 bg-transparent p-0 text-left"
            >
              <span className="truncate text-[14px] text-bone">{item.label || '(no label)'}</span>
              <span className="shrink-0 truncate font-mono text-[11px] text-smoke">{item.href}</span>
            </button>
            <AdminButton variant="ghost" onClick={() => onChange(swap(items, i, i - 1))} disabled={i === 0} className="px-2 py-1" aria-label="Move up">
              ↑
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => onChange(swap(items, i, i + 1))} disabled={i === items.length - 1} className="px-2 py-1" aria-label="Move down">
              ↓
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} className="px-2 py-1 text-flare-soft" aria-label="Remove item">
              ×
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => setOpen(open === item.id ? null : item.id)} className="px-2 py-1">
              {open === item.id ? '−' : '+'}
            </AdminButton>
          </div>

          {open === item.id && (
            <div className="space-y-4 border-t-2 border-hairline p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Navigation label">
                  <Input value={item.label} onChange={(e) => set(i, { label: e.target.value })} />
                </Field>
                <Field label="Title attribute" hint="tooltip text; optional">
                  <Input value={item.title ?? ''} onChange={(e) => set(i, { title: e.target.value || undefined })} />
                </Field>
              </div>

              <HrefField value={item.href} onChange={(href) => set(i, { href })} pages={pages} />

              <label className="flex items-center gap-2.5 text-[13px] text-ash">
                <input
                  type="checkbox"
                  checked={item.target === 'blank'}
                  onChange={(e) => set(i, { target: e.target.checked ? 'blank' : undefined })}
                  className="h-4 w-4 accent-flare"
                />
                Open in a new tab
              </label>

              {allowChildren && (
                <div className="border-t-2 border-hairline pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                      Sub-items ({item.children?.length ?? 0})
                    </span>
                    <AdminButton
                      variant="ghost"
                      onClick={() =>
                        set(i, {
                          children: [...(item.children ?? []), { id: newId(), label: 'New link', href: '/' }],
                        })
                      }
                    >
                      + Add sub-item
                    </AdminButton>
                  </div>
                  <p className="m-0 mb-3 text-[12px] text-smoke">
                    Opened from this link. A group gathers sub-items under a heading; an image turns a sub-item into a
                    card in the desktop menu.
                  </p>
                  <div className="space-y-2">
                    {(item.children ?? []).map((child, ci) => (
                      <ChildRow
                        key={child.id}
                        child={child}
                        onChange={(next) =>
                          set(i, { children: (item.children ?? []).map((c, j) => (j === ci ? next : c)) })
                        }
                        onRemove={() => set(i, { children: (item.children ?? []).filter((_, j) => j !== ci) })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <AdminButton
          variant="secondary"
          onClick={() => onChange([...items, { id: newId(), label: 'New link', href: '/' }])}
        >
          + Custom link
        </AdminButton>
        <Select
          value=""
          onChange={(e) => {
            const page = pages.find((p) => p.id === e.target.value);
            if (page) onChange([...items, { id: newId(), label: page.title, href: page.path }]);
          }}
          className="max-w-[260px]"
        >
          <option value="">+ Add an existing page…</option>
          {pages
            .filter((p) => p.status === 'published')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.path}
              </option>
            ))}
        </Select>
      </div>
    </div>
  );
}

/** One dropdown link: label and link, plus the details the richer menus use. */
function ChildRow({
  child,
  onChange,
  onRemove,
}: {
  child: NavChild;
  onChange: (next: NavChild) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const patch = (p: Partial<NavChild>) => {
    const next = { ...child, ...p };
    for (const key of ['group', 'description', 'imageUrl'] as const) if (!next[key]) delete next[key];
    onChange(next);
  };

  return (
    <div className="border-2 border-hairline bg-ink p-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Input value={child.label} placeholder="Label" onChange={(e) => patch({ label: e.target.value })} />
        <Input value={child.href} placeholder="/path" onChange={(e) => patch({ href: e.target.value })} />
        <AdminButton variant="ghost" onClick={() => setOpen((v) => !v)} className="px-2 py-1" aria-expanded={open}>
          {open ? 'Less' : 'More'}
        </AdminButton>
        <AdminButton variant="ghost" onClick={onRemove} className="px-2 py-1 text-flare-soft" aria-label="Remove sub-item">
          ×
        </AdminButton>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Group" hint="a heading these links share">
            <Input value={child.group ?? ''} maxLength={40} onChange={(e) => patch({ group: e.target.value })} />
          </Field>
          <Field label="Description" hint="one line under an image card">
            <Input value={child.description ?? ''} maxLength={160} onChange={(e) => patch({ description: e.target.value })} />
          </Field>
          <Field label="Image" hint="makes this link a card" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              {child.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={child.imageUrl} alt="" className="h-10 w-14 shrink-0 border-2 border-hairline object-cover" />
              ) : (
                <span className="flex h-10 w-14 shrink-0 items-center justify-center border-2 border-dashed border-hairline text-[10px] text-smoke">
                  None
                </span>
              )}
              <AdminButton variant="secondary" onClick={() => setPicking(true)}>
                Choose
              </AdminButton>
              {child.imageUrl && (
                <AdminButton variant="ghost" onClick={() => patch({ imageUrl: undefined })}>
                  Clear
                </AdminButton>
              )}
            </div>
          </Field>
        </div>
      )}
      <MediaPicker
        open={picking}
        accept="image"
        onClose={() => setPicking(false)}
        onSelect={(media) => {
          patch({ imageUrl: media.url });
          setPicking(false);
        }}
      />
    </div>
  );
}

/** A link target, chosen from the site's pages or typed by hand. */
function HrefField({
  value,
  onChange,
  pages,
}: {
  value: string;
  onChange: (next: string) => void;
  pages: PageRow[];
}) {
  const invalid = value.trim() !== '' && !isSafeHref(value);

  return (
    <Field
      label="Link"
      hint="a path like /about, a full https:// URL, or mailto: / tel:"
      error={invalid ? 'Not a valid link target.' : undefined}
    >
      <div className="flex gap-2">
        <Input value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
        <Select value="" onChange={(e) => e.target.value && onChange(e.target.value)} className="max-w-[190px]">
          <option value="">Pick a page…</option>
          {pages
            .filter((p) => p.status === 'published')
            .map((p) => (
              <option key={p.id} value={p.path}>
                {p.path}
              </option>
            ))}
        </Select>
      </div>
    </Field>
  );
}
