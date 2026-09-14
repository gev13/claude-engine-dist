'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { errorMessage } from '../_shared';

type SettingRow = { key: string; value: unknown; updatedById: string | null; updatedAt: string };
type ListResponse = { items: SettingRow[] };

type KnownField = {
  key: string;
  label: string;
  hint?: string;
  kind: 'text' | 'email' | 'boolean' | 'list' | 'choice';
  options?: { value: string; label: string }[];
};

/**
 * The settings the site actually reads. Every field here has a consumer named
 * in `src/lib/siteSettings.ts`.
 *
 * Fields were removed from this list when it turned out nothing read them — a
 * setting that saves and changes nothing is worse than no setting at all.
 */
const KNOWN: KnownField[] = [
  { key: 'site.name', label: 'Site name', kind: 'text', hint: 'page titles, Open Graph and structured data' },
  { key: 'site.tagline', label: 'Tagline', kind: 'text', hint: 'the default homepage title' },
  { key: 'site.description', label: 'Description', kind: 'text', hint: 'the default meta description' },
  { key: 'site.contactEmail', label: 'Contact email', kind: 'email', hint: 'shown in the footer and structured data' },
  {
    key: 'site.dateFormat',
    label: 'Date format',
    kind: 'choice',
    hint: 'how post dates render',
    options: [
      { value: 'd MMMM yyyy', label: '9 September 2026' },
      { value: 'MMMM d, yyyy', label: 'September 9, 2026' },
      { value: 'yyyy-MM-dd', label: '2026-09-09' },
      { value: 'dd/MM/yyyy', label: '09/09/2026' },
      { value: 'MM/dd/yyyy', label: '09/09/2026 (US)' },
    ],
  },
  { key: 'site.timeZone', label: 'Time zone', kind: 'text', hint: 'IANA name, e.g. Europe/London' },
  {
    key: 'seo.discourageSearchEngines',
    label: 'Discourage search engines',
    kind: 'boolean',
    hint: 'blocks indexing in robots.txt and the robots meta tag — for staging',
  },
  { key: 'seo.defaultRobots', label: 'Default robots directive', kind: 'text', hint: 'e.g. index,follow' },
];

const KNOWN_KEYS = new Set(KNOWN.map((field) => field.key));

/** Renders a stored value into the text box for its field kind. */
function toText(field: KnownField, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (field.kind === 'list') {
    return Array.isArray(value) ? value.map(String).join(', ') : String(value);
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function fromText(field: KnownField, text: string): unknown {
  if (field.kind === 'list') {
    return text
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return text;
}

export function SettingsScreen() {
  return (
    <ToastProvider>
      <SettingsScreenInner />
    </ToastProvider>
  );
}

function SettingsScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<ListResponse>('/api/admin/settings', fetcher);

  const [text, setText] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  /** key → JSON of the value as loaded, so only real changes are sent. */
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;

    const stored = new Map(data.items.map((row) => [row.key, row.value]));
    const nextText: Record<string, string> = {};
    const nextFlags: Record<string, boolean> = {};
    const nextCustom: Record<string, string> = {};
    const snapshot: Record<string, string> = {};

    for (const field of KNOWN) {
      const value = stored.get(field.key);
      if (field.kind === 'boolean') nextFlags[field.key] = value === true;
      else nextText[field.key] = toText(field, value);
      snapshot[field.key] = JSON.stringify(value ?? (field.kind === 'boolean' ? false : field.kind === 'list' ? [] : ''));
    }

    for (const row of data.items) {
      if (KNOWN_KEYS.has(row.key)) continue;
      nextCustom[row.key] = JSON.stringify(row.value, null, 2);
      snapshot[row.key] = JSON.stringify(row.value);
    }

    setText(nextText);
    setFlags(nextFlags);
    setCustom(nextCustom);
    setInitial(snapshot);
  }, [data]);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    const values: Record<string, unknown> = {};

    for (const field of KNOWN) {
      const value = field.kind === 'boolean' ? flags[field.key] === true : fromText(field, text[field.key] ?? '');
      if (JSON.stringify(value) !== initial[field.key]) values[field.key] = value;
    }

    for (const [key, raw] of Object.entries(custom)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        toast(`"${key}" is not valid JSON. Nothing was saved.`, 'error');
        return;
      }
      if (JSON.stringify(parsed) !== initial[key]) values[key] = parsed;
    }

    if (Object.keys(values).length === 0) {
      toast('Nothing has changed.', 'info');
      return;
    }

    setSaving(true);
    try {
      await api('/api/admin/settings', { method: 'PATCH', json: { values } });
      toast(`Saved ${Object.keys(values).length} setting${Object.keys(values).length === 1 ? '' : 's'}.`, 'success');
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not save the settings.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const customKeys = Object.keys(custom).sort();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Site-wide values the public pages read. Saving revalidates the cached site."
      />

      {isLoading && <Spinner label="Loading settings" />}

      {data && (
        <form onSubmit={save} className="space-y-6">
          <Panel title="Site">
            <div className="space-y-4">
              {KNOWN.filter((field) => field.key.startsWith('site.')).map((field) => (
                <KnownInput
                  key={field.key}
                  field={field}
                  text={text[field.key] ?? ''}
                  checked={flags[field.key] ?? false}
                  onText={(value) => setText((current) => ({ ...current, [field.key]: value }))}
                  onCheck={(value) => setFlags((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>
          </Panel>

          <Panel title="SEO">
            <div className="space-y-4">
              {KNOWN.filter((field) => field.key.startsWith('seo.')).map((field) => (
                <KnownInput
                  key={field.key}
                  field={field}
                  text={text[field.key] ?? ''}
                  checked={flags[field.key] ?? false}
                  onText={(value) => setText((current) => ({ ...current, [field.key]: value }))}
                  onCheck={(value) => setFlags((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Media">
            <div className="space-y-4">
              {KNOWN.filter((field) => field.key.startsWith('media.')).map((field) => (
                <KnownInput
                  key={field.key}
                  field={field}
                  text={text[field.key] ?? ''}
                  checked={flags[field.key] ?? false}
                  onText={(value) => setText((current) => ({ ...current, [field.key]: value }))}
                  onCheck={(value) => setFlags((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
            </div>
          </Panel>

          {customKeys.length > 0 && (
            <Panel title="Other settings">
              <p className="m-0 mb-4 text-[13px] text-smoke">
                Keys without a dedicated editor. Values are stored as JSON — a string needs its quotes.
              </p>
              <div className="space-y-4">
                {customKeys.map((key) => (
                  <Field key={key} label={key} htmlFor={`setting-${key}`}>
                    <Textarea
                      id={`setting-${key}`}
                      rows={3}
                      spellCheck={false}
                      className="font-mono text-[13px]"
                      value={custom[key] ?? ''}
                      onChange={(event) => setCustom((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  </Field>
                ))}
              </div>
            </Panel>
          )}

          <AdminButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </AdminButton>
        </form>
      )}
    </>
  );
}

function KnownInput({
  field,
  text,
  checked,
  onText,
  onCheck,
}: {
  field: KnownField;
  text: string;
  checked: boolean;
  onText: (value: string) => void;
  onCheck: (value: boolean) => void;
}) {
  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2.5 text-[14px] text-ash">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheck(event.target.checked)}
          className="h-4 w-4 accent-flare"
        />
        {field.label}
        {field.hint && <span className="text-smoke">({field.hint})</span>}
      </label>
    );
  }

  if (field.kind === 'choice') {
    return (
      <Field label={field.label} hint={field.hint} htmlFor={`setting-${field.key}`}>
        <Select id={`setting-${field.key}`} value={text} onChange={(event) => onText(event.target.value)}>
          <option value="">Default</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  return (
    <Field label={field.label} hint={field.hint} htmlFor={`setting-${field.key}`}>
      <Input
        id={`setting-${field.key}`}
        type={field.kind === 'email' ? 'email' : 'text'}
        value={text}
        onChange={(event) => onText(event.target.value)}
      />
    </Field>
  );
}
