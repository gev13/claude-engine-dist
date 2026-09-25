'use client';

import { useState } from 'react';
import { AdminButton, Field, Input, Select, Textarea } from '@/components/admin/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { cn } from '@/lib/utils';
import type { SeoFields } from '@/server/db/schema';

const TITLE_IDEAL = 60;
const DESCRIPTION_IDEAL = 155;

function Counter({ value, ideal }: { value: string; ideal: number }) {
  const over = value.length > ideal;
  return (
    <span
      className={cn('font-mono text-[10px] tracking-[0.1em]', over ? 'text-amber-400' : 'text-smoke')}
      title={over ? `Search results usually truncate past ${ideal} characters` : undefined}
    >
      {value.length}/{ideal}
    </span>
  );
}

/**
 * Per-entity SEO editing. Every field is optional: what is left blank falls
 * back to the page's own title and excerpt at render time, so an un-edited
 * page is still correct rather than empty.
 */
export function SeoPanel({
  value,
  onChange,
  fallbackTitle,
  fallbackDescription,
  path,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '',
}: {
  value: SeoFields;
  onChange: (next: SeoFields) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  path: string;
  siteUrl?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof SeoFields>(key: K, next: SeoFields[K]) => onChange({ ...value, [key]: next });

  const previewTitle = value.title?.trim() || fallbackTitle;
  const previewDescription = value.description?.trim() || fallbackDescription;
  const extraMeta = value.extraMeta ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* SERP preview — what this page will actually look like in results. */}
      <div className="border-2 border-hairline bg-ink p-4">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-smoke/70">Search preview</div>
        <div className="truncate font-mono text-[11px] text-emerald-400/80">
          {siteUrl.replace(/^https?:\/\//, '')}
          {path}
        </div>
        <div className="mt-1 line-clamp-1 text-[16px] text-flare-soft">{previewTitle}</div>
        <p className="m-0 mt-1 line-clamp-2 text-[13px] leading-snug text-ash">
          {previewDescription || 'No description yet — search engines will pick their own snippet.'}
        </p>
      </div>

      <Field
        label="Meta title"
        htmlFor="seo-title"
        hint={value.title ? undefined : 'falls back to the page title'}
      >
        <Input
          id="seo-title"
          value={value.title ?? ''}
          onChange={(e) => set('title', e.target.value)}
          placeholder={fallbackTitle}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={value.exactTitle === true} onChange={(e) => set('exactTitle', e.target.checked || undefined)} />
            Use exactly this title — without the site name after it
          </label>
          <Counter value={value.title ?? fallbackTitle} ideal={TITLE_IDEAL} />
        </div>
      </Field>

      <Field
        label="Meta description"
        htmlFor="seo-description"
        hint={value.description ? undefined : 'falls back to the excerpt'}
      >
        <Textarea
          id="seo-description"
          rows={3}
          value={value.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder={fallbackDescription}
        />
        <div className="mt-1 flex justify-end">
          <Counter value={value.description ?? fallbackDescription} ideal={DESCRIPTION_IDEAL} />
        </div>
      </Field>

      <Field label="Social share image" hint="1200×630 recommended">
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={value.ogImageId ?? ''}
            placeholder="Site default"
            className="flex-1"
            aria-label="Open Graph image"
          />
          <AdminButton variant="secondary" type="button" onClick={() => setPickerOpen(true)}>
            Choose
          </AdminButton>
          {value.ogImageId && (
            <AdminButton variant="ghost" type="button" onClick={() => set('ogImageId', undefined)}>
              Clear
            </AdminButton>
          )}
        </div>
      </Field>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="cursor-pointer bg-transparent p-0 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
      >
        {showAdvanced ? '− Hide advanced' : '+ Advanced: canonical, robots, social overrides, extra tags'}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-5 border-l-2 border-hairline pl-4">
          <Field label="Canonical URL" htmlFor="seo-canonical" hint="leave blank for the page's own URL">
            <Input
              id="seo-canonical"
              value={value.canonicalUrl ?? ''}
              onChange={(e) => set('canonicalUrl', e.target.value)}
              placeholder={`${siteUrl}${path}`}
            />
          </Field>

          <Field label="Robots" htmlFor="seo-robots">
            <Select
              id="seo-robots"
              value={value.robots ?? 'index, follow'}
              onChange={(e) => set('robots', e.target.value)}
            >
              <option value="index, follow">index, follow (default)</option>
              <option value="noindex, follow">noindex, follow</option>
              <option value="index, nofollow">index, nofollow</option>
              <option value="noindex, nofollow">noindex, nofollow</option>
            </Select>
          </Field>

          <Field label="Social title" htmlFor="seo-og-title" hint="falls back to the meta title">
            <Input
              id="seo-og-title"
              value={value.ogTitle ?? ''}
              onChange={(e) => set('ogTitle', e.target.value)}
              placeholder={previewTitle}
            />
          </Field>

          <Field label="Social description" htmlFor="seo-og-description">
            <Textarea
              id="seo-og-description"
              rows={2}
              value={value.ogDescription ?? ''}
              onChange={(e) => set('ogDescription', e.target.value)}
              placeholder={previewDescription}
            />
          </Field>

          <Field label="Twitter card" htmlFor="seo-twitter">
            <Select
              id="seo-twitter"
              value={value.twitterCard ?? 'summary_large_image'}
              onChange={(e) => set('twitterCard', e.target.value as SeoFields['twitterCard'])}
            >
              <option value="summary_large_image">Large image</option>
              <option value="summary">Summary</option>
            </Select>
          </Field>

          <JsonLdField value={value.jsonLd} onChange={(next) => set('jsonLd', next)} />

          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Extra meta tags</div>
            {extraMeta.map((meta, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <Input
                  value={meta.name ?? meta.property ?? ''}
                  onChange={(e) => {
                    const next = [...extraMeta];
                    const key = e.target.value;
                    // og:* and twitter:* are property attributes; everything
                    // else is a name attribute.
                    next[i] = /^(og|twitter|fb|article|product):/i.test(key)
                      ? { property: key, content: meta.content }
                      : { name: key, content: meta.content };
                    set('extraMeta', next);
                  }}
                  placeholder="name or property"
                  className="flex-1"
                  aria-label={`Meta tag ${i + 1} name`}
                />
                <Input
                  value={meta.content}
                  onChange={(e) => {
                    const next = [...extraMeta];
                    next[i] = { ...meta, content: e.target.value };
                    set('extraMeta', next);
                  }}
                  placeholder="content"
                  className="flex-[2]"
                  aria-label={`Meta tag ${i + 1} content`}
                />
                <AdminButton
                  variant="ghost"
                  type="button"
                  onClick={() => set('extraMeta', extraMeta.filter((_, j) => j !== i))}
                  aria-label={`Remove meta tag ${i + 1}`}
                >
                  ×
                </AdminButton>
              </div>
            ))}
            <AdminButton
              variant="secondary"
              type="button"
              onClick={() => set('extraMeta', [...extraMeta, { name: '', content: '' }])}
            >
              Add meta tag
            </AdminButton>
          </div>
        </div>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(media) => set('ogImageId', media.id)}
        accept="image"
      />
    </div>
  );
}

/**
 * Structured data of the editor's own, added to the page's graph (2.18). Kept
 * as text while it is being typed, and only handed up once it is valid — an
 * object or a list of objects — so a half-typed brace never saves.
 */
function JsonLdField({ value, onChange }: { value: unknown[] | undefined; onChange: (next: Record<string, unknown>[] | undefined) => void }) {
  const [text, setText] = useState(() => (value && value.length ? JSON.stringify(value.length === 1 ? value[0] : value, null, 2) : ''));
  const [problem, setProblem] = useState('');
  return (
    <Field label="Structured data (JSON-LD)" hint="an object or a list of objects; added to the page’s own graph" error={problem || undefined}>
      <Textarea
        rows={5}
        spellCheck={false}
        className="font-mono text-[12px]"
        value={text}
        placeholder={'{ "@type": "Event", "name": "…" }'}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (!next.trim()) {
            setProblem('');
            onChange(undefined);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(next);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            if (!list.every((item) => item && typeof item === 'object' && !Array.isArray(item))) throw new Error('objects');
            setProblem('');
            onChange(list as Record<string, unknown>[]);
          } catch {
            setProblem('Not valid yet — it needs to be a JSON object, or a list of them.');
          }
        }}
      />
    </Field>
  );
}
