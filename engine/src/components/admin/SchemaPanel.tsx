'use client';

import { useState } from 'react';
import { Field, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { JsonLdField } from '@/components/admin/SeoPanel';
import { JsonLdPreview } from '@/components/admin/JsonLdPreview';
import {
  ARTICLE_TYPES,
  PAGE_TYPES,
  PAGE_TYPE_LABELS,
  pageServiceSchema,
  type PageSchema,
  type PageService,
} from '@/lib/structuredData';
import type { SeoFields } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   The Schema panel (3.20) — beside SEO on pages, posts and projects
   ───────────────────────────────────────────────────────────────────────────
   What the page tells search engines beyond its title: the kind of page it
   is, the service it describes, whether it lists the services, and the
   generated parts it can switch off. Every field left empty keeps what the
   engine works out by itself, and says so. Site-wide values (the
   organization, service defaults) are Admin → Structured data.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SchemaPanelKind = 'page' | 'post' | 'project';

/** One entry per line, blank lines dropped. */
export const toLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ash">
      <input type="checkbox" className="h-4 w-4 accent-flare" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Drop empty strings and empty objects, so an untouched panel stores nothing. */
function compact<T extends Record<string, unknown>>(value: T): T | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === '' || (Array.isArray(item) && item.length === 0)) continue;
    out[key] = item;
  }
  return Object.keys(out).length ? (out as T) : undefined;
}

export function SchemaPanel({
  value,
  onChange,
  kind,
  isService = false,
  path,
  published = false,
}: {
  value: SeoFields;
  onChange: (next: SeoFields) => void;
  kind: SchemaPanelKind;
  /** A page with the service template: it describes a Service by default. */
  isService?: boolean;
  path: string;
  published?: boolean;
}) {
  const schema: PageSchema = value.schema ?? {};
  const [previewOpen, setPreviewOpen] = useState(false);

  const setSchema = (next: PageSchema) => onChange({ ...value, schema: compact(next as Record<string, unknown>) as PageSchema | undefined });
  const set = <K extends keyof PageSchema>(key: K, next: PageSchema[K]) => setSchema({ ...schema, [key]: next });
  const service: PageService = schema.service ?? {};
  const setService = <K extends keyof PageService>(key: K, next: PageService[K]) =>
    set('service', compact({ ...service, [key]: next } as Record<string, unknown>) as PageService | undefined);
  const serviceProblem = schema.service ? pageServiceSchema.safeParse(schema.service) : null;

  return (
    <div className="flex flex-col gap-5">
      <Field label="Page type" htmlFor="schema-type" hint={kind === 'post' ? 'the page around the article' : 'what search engines are told this page is'}>
        <Select id="schema-type" value={schema.pageType ?? ''} onChange={(e) => set('pageType', (e.target.value || undefined) as PageSchema['pageType'])}>
          <option value="">Automatic (web page; a page listing the services is a collection)</option>
          {PAGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {PAGE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>

      {kind === 'post' && (
        <>
          <Field label="Article type" htmlFor="schema-article" hint="empty uses the site's default (Admin → Structured data)">
            <Select id="schema-article" value={schema.articleType ?? ''} onChange={(e) => set('articleType', (e.target.value || undefined) as PageSchema['articleType'])}>
              <option value="">Site default</option>
              {ARTICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Author name" htmlFor="schema-author" hint="empty uses the author's account name">
            <Input id="schema-author" value={schema.authorName ?? ''} onChange={(e) => set('authorName', e.target.value || undefined)} />
          </Field>
          <Field label="Author profile" htmlFor="schema-author-url" hint="https://… — a profile page or LinkedIn">
            <Input id="schema-author-url" value={schema.authorUrl ?? ''} onChange={(e) => set('authorUrl', e.target.value || undefined)} />
          </Field>
        </>
      )}

      {kind === 'page' && (
        <>
          <Field label="List of services" htmlFor="schema-list" hint="an ItemList naming every service page">
            <Select id="schema-list" value={schema.listServices ?? ''} onChange={(e) => set('listServices', (e.target.value || undefined) as PageSchema['listServices'])}>
              <option value="">Automatic (the services block, or the page the services sit under)</option>
              <option value="on">Always on this page</option>
              <option value="off">Never on this page</option>
            </Select>
          </Field>

          {isService && (
            <div className="flex flex-col gap-4 border-l-2 border-hairline pl-4">
              <Check label="Describe this page as a Service" checked={service.enabled !== false} onChange={(on) => setService('enabled', on ? undefined : false)} />
              {service.enabled !== false && (
                <>
                  <p className="m-0 text-[12px] leading-relaxed text-smoke">
                    Empty fields use the page (name, excerpt) and the service defaults in Admin → Structured data.
                  </p>
                  <Field label="Service name" htmlFor="svc-name">
                    <Input id="svc-name" value={service.name ?? ''} onChange={(e) => setService('name', e.target.value || undefined)} />
                  </Field>
                  <Field label="Service type" htmlFor="svc-type" hint="e.g. Penetration testing — empty uses the name">
                    <Input id="svc-type" value={service.serviceType ?? ''} onChange={(e) => setService('serviceType', e.target.value || undefined)} />
                  </Field>
                  <Field label="Category" htmlFor="svc-category" hint="the broad kind, e.g. Cybersecurity">
                    <Input id="svc-category" value={service.category ?? ''} onChange={(e) => setService('category', e.target.value || undefined)} />
                  </Field>
                  <Field label="Description" htmlFor="svc-description" hint="empty uses the page's excerpt">
                    <Textarea id="svc-description" rows={3} value={service.description ?? ''} onChange={(e) => setService('description', e.target.value || undefined)} />
                  </Field>
                  <Field label="Audience" htmlFor="svc-audience" hint="who it is for, e.g. Online casino operators">
                    <Input id="svc-audience" value={service.audience ?? ''} onChange={(e) => setService('audience', e.target.value || undefined)} />
                  </Field>
                  <Lines label="Area served" hint="one per line — a country, a region, or Worldwide" value={service.areaServed} onChange={(next) => setService('areaServed', next)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Price" htmlFor="svc-price">
                      <Input id="svc-price" inputMode="decimal" value={service.price ?? ''} onChange={(e) => setService('price', e.target.value || undefined)} placeholder="1500" />
                    </Field>
                    <Field label="Currency" htmlFor="svc-currency">
                      <Input id="svc-currency" value={service.priceCurrency ?? ''} onChange={(e) => setService('priceCurrency', e.target.value.toUpperCase() || undefined)} placeholder="EUR" maxLength={3} />
                    </Field>
                  </div>
                  <Field label="The price is" htmlFor="svc-kind" hint="optional — leave the price empty to state none">
                    <Select id="svc-kind" value={service.priceKind ?? ''} onChange={(e) => setService('priceKind', (e.target.value || undefined) as PageService['priceKind'])}>
                      <option value="">the price</option>
                      <option value="from">a starting price</option>
                    </Select>
                  </Field>
                  <Field label="Offer note" htmlFor="svc-offer" hint="optional, e.g. Fixed-scope engagement, quoted per project">
                    <Input id="svc-offer" value={service.offerDescription ?? ''} onChange={(e) => setService('offerDescription', e.target.value || undefined)} />
                  </Field>
                  {serviceProblem && !serviceProblem.success && (
                    <p className="m-0 text-[12px] text-flare-soft">
                      {serviceProblem.error.issues[0]?.path.join(' ')}: {serviceProblem.error.issues[0]?.message}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <Check label="Breadcrumbs" checked={schema.breadcrumbs !== false} onChange={(on) => set('breadcrumbs', on ? undefined : false)} />
        {kind !== 'project' && <Check label="FAQ from this page's FAQ block" checked={schema.faq !== false} onChange={(on) => set('faq', on ? undefined : false)} />}
      </div>

      <JsonLdField value={value.jsonLd} onChange={(next) => onChange({ ...value, jsonLd: next })} />

      {published && (
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen((open) => !open)}
            className="cursor-pointer bg-transparent p-0 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
          >
            {previewOpen ? '− Hide what the published page emits' : '+ Show what the published page emits'}
          </button>
          {previewOpen && (
            <div className="mt-3">
              <JsonLdPreview path={path} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The panel as the editors place it: closed, with a line saying whether this entry has its own settings. */
export function SchemaSection(props: Parameters<typeof SchemaPanel>[0]) {
  const [open, setOpen] = useState(false);
  const what = props.kind === 'post' ? 'post' : props.kind === 'project' ? 'project' : 'page';
  return (
    <Panel
      title="Schema"
      actions={
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="cursor-pointer bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
        >
          {open ? 'Hide' : 'Edit'}
        </button>
      }
    >
      {open ? (
        <SchemaPanel {...props} />
      ) : (
        <p className="m-0 text-[13px] leading-relaxed text-ash">
          {props.value.schema || props.value.jsonLd?.length
            ? `This ${what} has its own structured data settings.`
            : `Search engines get the structured data the engine works out for this ${what}.`}
        </p>
      )}
    </Panel>
  );
}
