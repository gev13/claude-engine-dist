'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { JsonLdPreview } from '@/components/admin/JsonLdPreview';
import { toLines } from '@/components/admin/SchemaPanel';
import { AdminButton, AdminLinkButton, Alert, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import {
  ARTICLE_TYPES,
  LOCAL_TYPES,
  ORGANIZATION_TYPES,
  ORGANIZATION_TYPE_LABELS,
  siteSchemaSchema,
  type ContactPoint,
  type ServiceDefaults,
  type SiteSchema,
} from '@/lib/structuredData';
import { errorMessage, useUnsavedWarning } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Admin → Structured data (3.20)
   ───────────────────────────────────────────────────────────────────────────
   The site's half of its structured data: the organization beyond the
   name, address and logo in Settings, the defaults every service page starts
   from, and the site-wide parts of the graph. Each page's own half is the
   Schema panel in its editor. The preview reads any published page as a
   visitor gets it.
   ═══════════════════════════════════════════════════════════════════════════ */

type Response = { schema: SiteSchema };
type PageRow = { id: string; title: string; path: string; status: string };

function Lines({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string[] | undefined; onChange: (next: string[] | undefined) => void; placeholder?: string }) {
  const [text, setText] = useState(() => (value ?? []).join('\n'));
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={3}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const lines = toLines(e.target.value);
          onChange(lines.length ? lines : undefined);
        }}
      />
    </Field>
  );
}

function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-[13px] text-ash">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-flare" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-[12px] text-smoke">{hint}</span>}
      </span>
    </label>
  );
}

const blank = (value: string) => (value.trim() ? value : undefined);

function ContactPoints({ value, onChange }: { value: ContactPoint[]; onChange: (next: ContactPoint[] | undefined) => void }) {
  const update = (index: number, patch: Partial<ContactPoint>) => {
    const next = value.map((point, i) => (i === index ? { ...point, ...patch } : point));
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-4">
      {value.map((point, index) => (
        <div key={index} className="grid gap-3 border-2 border-hairline p-4 md:grid-cols-2">
          <Field label="Kind" hint="sales, customer support, technical support…">
            <Input value={point.contactType} onChange={(e) => update(index, { contactType: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={point.email ?? ''} onChange={(e) => update(index, { email: blank(e.target.value) })} />
          </Field>
          <Field label="Phone">
            <Input value={point.telephone ?? ''} onChange={(e) => update(index, { telephone: blank(e.target.value) })} />
          </Field>
          <Field label="Page" hint="https://…">
            <Input value={point.url ?? ''} onChange={(e) => update(index, { url: blank(e.target.value) })} />
          </Field>
          <Field label="Languages" hint="comma separated, e.g. English, Russian">
            <Input
              value={(point.availableLanguage ?? []).join(', ')}
              onChange={(e) => {
                const list = e.target.value.split(',').map((item) => item.trim()).filter(Boolean);
                update(index, { availableLanguage: list.length ? list : undefined });
              }}
            />
          </Field>
          <div className="flex items-end justify-end">
            <AdminButton type="button" variant="ghost" onClick={() => onChange(value.filter((_, i) => i !== index).length ? value.filter((_, i) => i !== index) : undefined)}>
              Remove
            </AdminButton>
          </div>
        </div>
      ))}
      <div>
        <AdminButton type="button" variant="secondary" onClick={() => onChange([...value, { contactType: 'sales' }])} disabled={value.length >= 10}>
          + Add a contact point
        </AdminButton>
      </div>
    </div>
  );
}

export function SchemaScreen() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/schema', fetcher);
  const { data: pageList } = useSWR<{ items: PageRow[] }>('/api/admin/pages?perPage=100&status=published', fetcher);

  const [form, setForm] = useState<SiteSchema | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [previewPath, setPreviewPath] = useState('/');

  useEffect(() => {
    if (!data) return;
    setForm(data.schema);
    setSaved(JSON.stringify(data.schema));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  const set = <K extends keyof SiteSchema>(key: K, value: SiteSchema[K]) =>
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (value === undefined) delete next[key];
      return next;
    });
  const setDefaults = <K extends keyof ServiceDefaults>(key: K, value: ServiceDefaults[K]) => {
    const next = { ...(form?.serviceDefaults ?? {}), [key]: value };
    if (value === undefined) delete next[key];
    set('serviceDefaults', Object.keys(next).length ? next : undefined);
  };

  async function save() {
    if (!form) return;
    const checked = siteSchemaSchema.safeParse(form);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      setProblem(`${issue?.path.join(' → ') || 'A value'}: ${issue?.message}`);
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response>('/api/admin/schema', { method: 'PUT', json: { schema: checked.data } });
      setForm(result.schema);
      setSaved(JSON.stringify(result.schema));
      await mutate(result, { revalidate: false });
      toast('Saved. Every page has been revalidated.', 'success');
    } catch (caught) {
      const message = errorMessage(caught, 'The structured data settings could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <PageHeader
      title="Structured data"
      description="What every page tells search engines about the organization behind the site. Each page's own settings are the Schema panel in its editor."
    />
  );
  if (isLoading || !form) {
    return (
      <>
        {header}
        <Spinner />
      </>
    );
  }

  const type = form.organizationType ?? 'Organization';
  const pages = (pageList?.items ?? []).filter((page) => page.status === 'published');

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {problem && <Alert>{problem}</Alert>}

        <Panel title="Organization" actions={<AdminLinkButton href="/admin/settings" variant="ghost">Name, address, logo →</AdminLinkButton>}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Type" htmlFor="org-type" hint="search engines treat a local business as a place people visit">
              <Select id="org-type" value={type} onChange={(e) => set('organizationType', e.target.value === 'Organization' ? undefined : (e.target.value as SiteSchema['organizationType']))}>
                {ORGANIZATION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {ORGANIZATION_TYPE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
            {LOCAL_TYPES.includes(type) ? (
              <Field label="Price range" htmlFor="org-price" hint="e.g. $$ or €100–€500">
                <Input id="org-price" value={form.priceRange ?? ''} onChange={(e) => set('priceRange', blank(e.target.value))} />
              </Field>
            ) : (
              <div />
            )}
            <Lines label="Knows about" hint="topics it is an authority on, one per line" value={form.knowsAbout} onChange={(next) => set('knowsAbout', next)} placeholder={'Penetration testing\nCloud security'} />
            <Lines label="Area served" hint="one per line — a country, a region, or Worldwide" value={form.areaServed} onChange={(next) => set('areaServed', next)} placeholder="Worldwide" />
            <Lines label="Other profiles" hint="https://… one per line — beyond Menus → Social links (a directory, a registry, Wikidata)" value={form.sameAs} onChange={(next) => set('sameAs', next)} />
            <div className="grid gap-5">
              <Field label="VAT number" htmlFor="org-vat">
                <Input id="org-vat" value={form.vatId ?? ''} onChange={(e) => set('vatId', blank(e.target.value))} />
              </Field>
              <Field label="Tax or registration number" htmlFor="org-tax">
                <Input id="org-tax" value={form.taxId ?? ''} onChange={(e) => set('taxId', blank(e.target.value))} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Contact points">
          <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
            The contact email in Settings is already listed as customer support. Add others — a sales line, a security contact.
          </p>
          <ContactPoints value={form.contactPoints ?? []} onChange={(next) => set('contactPoints', next)} />
        </Panel>

        <Panel title="Services">
          <div className="flex flex-col gap-5">
            <Check
              label="List every service on the Organization (offer catalogue)"
              hint="each service page's Service, named once more under the organization that provides it"
              checked={form.offerCatalog === true}
              onChange={(on) => set('offerCatalog', on || undefined)}
            />
            <p className="m-0 text-[13px] leading-relaxed text-ash">Defaults every service page starts from; a page’s Schema panel can say otherwise.</p>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Category" htmlFor="svc-category" hint="the broad kind, e.g. Cybersecurity">
                <Input id="svc-category" value={form.serviceDefaults?.category ?? ''} onChange={(e) => setDefaults('category', blank(e.target.value))} />
              </Field>
              <Field label="Audience" htmlFor="svc-audience" hint="who the services are for">
                <Input id="svc-audience" value={form.serviceDefaults?.audience ?? ''} onChange={(e) => setDefaults('audience', blank(e.target.value))} />
              </Field>
              <Lines label="Area served" hint="one per line" value={form.serviceDefaults?.areaServed} onChange={(next) => setDefaults('areaServed', next)} placeholder="Worldwide" />
              <Field label="Price currency" htmlFor="svc-currency" hint="for pages that give a price, e.g. EUR">
                <Input id="svc-currency" maxLength={3} value={form.serviceDefaults?.priceCurrency ?? ''} onChange={(e) => setDefaults('priceCurrency', blank(e.target.value.toUpperCase()))} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Every page">
          <div className="flex flex-col gap-4">
            <Check label="The menus as site navigation" hint="SiteNavigationElement, from the header and footer menus and the services" checked={form.navigation !== false} onChange={(on) => set('navigation', on ? undefined : false)} />
            <Check label="Speakable hints" hint="which parts of a page suit being read aloud: its heading, its text, its FAQ" checked={form.speakable !== false} onChange={(on) => set('speakable', on ? undefined : false)} />
            <Field label="Posts are published as" htmlFor="article-type" hint="a post's Schema panel can choose another">
              <Select id="article-type" value={form.articleType ?? 'Article'} onChange={(e) => set('articleType', e.target.value === 'Article' ? undefined : (e.target.value as SiteSchema['articleType']))}>
                {ARTICLE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </AdminButton>
          {dirty && <span className="text-[13px] text-smoke">Unsaved changes</span>}
        </div>

        <Panel title="Preview">
          <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
            A published page as search engines read it. When a validator cannot fetch the site (a firewall in front of it), copy the result and paste it into the validator&apos;s code tab.
          </p>
          <Field label="Page" htmlFor="preview-page">
            <Select id="preview-page" value={previewPath} onChange={(e) => setPreviewPath(e.target.value)}>
              {!pages.some((page) => page.path === '/') && <option value="/">/</option>}
              {pages.map((page) => (
                <option key={page.id} value={page.path}>
                  {page.path} — {page.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4">
            <JsonLdPreview key={previewPath} path={previewPath} />
          </div>
        </Panel>
      </div>
    </>
  );
}
