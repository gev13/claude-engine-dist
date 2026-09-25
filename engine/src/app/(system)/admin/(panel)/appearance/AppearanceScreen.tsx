'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import {
  BREAKPOINTS,
  BUTTON_VARIANTS,
  BUTTON_VARIANT_LABELS,
  CHART_DEFAULTS,
  STATUS_DEFAULTS,
  TYPE_ROLES,
  TYPE_ROLE_LABELS,
  emptyTheme,
  type BreakpointKey,
  type ButtonVariant,
  type FontKey,
  type Theme,
  type TypeRole,
} from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';
import { cn } from '@/lib/utils';
import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';
import { FONT_GROUPS, SCRIPT_LABELS, fontWarning, scriptFor, warningText } from '@/lib/fonts';
import { localeConfig, localeName } from '@/lib/locales';
import { colorVar, typeVar, useThemeDefaults } from '@/components/admin/themeDefaults';
import {
  FOOTER_VARIANT_LABELS,
  HEADER_VARIANT_LABELS,
  MEGA_VARIANT_LABELS,
  MOBILE_MENU_LABELS,
  type FooterVariant,
  type HeaderVariant,
  type MegaVariant,
  type MobileMenuVariant,
} from '@/lib/chrome';
import { isSafeHref } from '@/lib/navigation';
import { ArchiveFeaturesPanel, PostFeaturesPanel } from './BlogFeaturePanels';
import { BLOG_INDEX_LABELS, BLOG_POST_LABELS, type BlogIndexLayout, type BlogPostLayout, ARCHIVE_PAGERS, ARCHIVE_PAGER_LABELS, LEGACY_ARCHIVE_PER_PAGE, LEGACY_INDEX_PER_PAGE, MAX_ARCHIVE_PER_PAGE } from '@/lib/blog';
import { Wireframe } from '@/components/admin/Wireframe';
import {
  BLOG_INDEX_WIREFRAMES,
  BLOG_POST_WIREFRAMES,
  FOOTER_WIREFRAMES,
  HEADER_WIREFRAMES,
  MEGA_WIREFRAMES,
  MOBILE_MENU_WIREFRAMES,
  type Wire,
} from '@/lib/wireframes';

type ThemeResponse = { theme: Theme };

const TABS = ['Colours', 'Typography', 'Buttons', 'Layout', 'Brand', 'Header & menus', 'Footer', 'Blog', 'Site-wide'] as const;

/** A row of choice cards: the variant pickers for header, menus and footer. */
function VariantPicker<T extends string>({
  label,
  value,
  fallback,
  options,
  onChange,
  wireframes,
}: {
  label: string;
  value: T | undefined;
  fallback: T;
  options: Record<T, { label: string; hint: string }>;
  onChange: (next: T | undefined) => void;
  /** A thumbnail per option, from src/lib/wireframes.ts. */
  wireframes?: Record<T, Wire>;
}) {
  const current = value ?? fallback;
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{label}</legend>
      <div className={cn('grid gap-2', wireframes ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2')}>
        {(Object.keys(options) as T[]).map((key) => {
          const wire = wireframes?.[key];
          return (
            <label
              key={key}
              className={cn(
                'flex cursor-pointer border-2 p-3 transition-colors',
                wire ? 'flex-col gap-2.5' : 'gap-3',
                current === key ? 'border-flare bg-ink' : 'border-hairline hover:border-rule',
              )}
            >
              {wire && (
                <Wireframe shapes={wire.shapes} width={wire.width} className={wire.width === 50 ? 'mx-auto max-w-[72px]' : undefined} />
              )}
              <span className="flex gap-3">
                <input
                  type="radio"
                  name={label}
                  checked={current === key}
                  onChange={() => onChange(key === fallback ? undefined : key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-flare"
                />
                <span>
                  <span className="block text-[14px] text-bone">{options[key].label}</span>
                  <span className="block text-[12px] text-smoke">{options[key].hint}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A checkbox bound to an optional boolean, with the default the site ships with. */
function Toggle({
  label,
  value,
  fallback = false,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  fallback?: boolean;
  onChange: (next: boolean | undefined) => void;
}) {
  const checked = value ?? fallback;
  return (
    <label className="flex items-center gap-2.5 text-[14px] text-ash">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked === fallback ? undefined : e.target.checked)}
        className="h-4 w-4 accent-flare"
      />
      {label}
    </label>
  );
}
type Tab = (typeof TABS)[number];

/* ── Immutable edits ──────────────────────────────────────────────────────────
   The theme is a tree of optional objects, so every setter has to create the
   branches it writes into. Doing that once here keeps each field a one-liner.
   A field set back to undefined is deleted rather than stored as null, so the
   saved theme only ever contains what somebody actually chose.
   ──────────────────────────────────────────────────────────────────────────── */

type Path = readonly (string | number)[];

function setIn<T>(source: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const base = (source ?? {}) as Record<string, unknown>;
  const child = setIn(base[head as string], rest, value);

  const next = { ...base };
  if (child === undefined || (typeof child === 'object' && child !== null && Object.keys(child).length === 0)) {
    delete next[head as string];
  } else {
    next[head as string] = child;
  }
  return next as T;
}

function getIn(source: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key as string] : undefined),
    source,
  );
}

/* Sixty faces: grouped, or the picker stops being a menu. */
const FONT_OPTIONS = FONT_GROUPS;

const WEIGHT_OPTIONS = (['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const).map((value) => ({
  value,
  label: value,
}));

const TRANSFORM_OPTIONS = (['none', 'uppercase', 'lowercase', 'capitalize'] as const).map((value) => ({
  value,
  label: value,
}));

const DECORATION_OPTIONS = (['none', 'underline', 'line-through'] as const).map((value) => ({ value, label: value }));

const STYLE_OPTIONS = (['normal', 'italic'] as const).map((value) => ({ value, label: value }));

export function AppearanceScreen() {
  return (
    <ToastProvider>
      <AppearanceScreenInner />
    </ToastProvider>
  );
}

function AppearanceScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<ThemeResponse>('/api/admin/theme', fetcher);

  const [theme, setTheme] = useState<Theme>(emptyTheme);
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState<Tab>('Colours');
  const [role, setRole] = useState<TypeRole>('h1');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<null | 'logo' | 'logoMobile' | 'favicon'>(null);

  useEffect(() => {
    if (!data) return;
    setTheme(data.theme);
    setSaved(JSON.stringify(data.theme));
  }, [data]);

  const dirty = JSON.stringify(theme) !== saved;

  /* What every empty field is actually worth, read from the stylesheet the
     admin already loads rather than from a second copy of the defaults. */
  const defaults = useThemeDefaults();

  const set = (path: Path) => (value: unknown) => setTheme((current) => setIn(current, path, value));
  const get = (path: Path) => getIn(theme, path) as string | undefined;

  /* The preview is the same generator the site uses, pointed at a container
     rather than at :root — so what an editor sees is produced by the code that
     will render the page, not by a second implementation of it. */
  const previewCss = useMemo(
    () => themeToCss(theme, { selector: '.he-preview', responsive: false }),
    [theme],
  );

  async function save() {
    setSaving(true);
    try {
      const result = await api<ThemeResponse>('/api/admin/theme', { method: 'PUT', json: theme });
      setTheme(result.theme);
      setSaved(JSON.stringify(result.theme));
      await mutate(result, { revalidate: false });
      toast('Theme saved. Every page has been revalidated.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the theme.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm('Reset every appearance setting to the built-in design? This cannot be undone.')) return;
    setSaving(true);
    try {
      const result = await api<ThemeResponse>('/api/admin/theme', { method: 'DELETE' });
      setTheme(result.theme);
      setSaved(JSON.stringify(result.theme));
      await mutate(result, { revalidate: false });
      toast('Theme reset to the built-in design.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not reset the theme.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Appearance"
        description="The site's global design: colours, type, buttons, layout and brand. Changes apply to every public page."
        actions={
          <>
            <AdminButton variant="ghost" onClick={reset} disabled={saving}>
              Reset to default
            </AdminButton>
            <AdminButton onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </AdminButton>
          </>
        }
      />

      {isLoading && <Spinner label="Loading the theme" />}

      <nav className="mb-6 flex flex-wrap gap-1 border-b-2 border-hairline">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              '-mb-0.5 border-b-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
              tab === item ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
            )}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {tab === 'Colours' && (
            <>
              <Panel title="Palette">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField label="Page background" hint="the base surface" value={get(['colors', 'background'])} inherited={defaults[colorVar('background')!]} onChange={set(['colors', 'background'])} />
                  <ColorField label="Raised surface" hint="cards and alternate bands" value={get(['colors', 'surface'])} inherited={defaults[colorVar('surface')!]} onChange={set(['colors', 'surface'])} />
                  <ColorField label="Third surface" hint="hover states" value={get(['colors', 'surfaceRaised'])} inherited={defaults[colorVar('surfaceRaised')!]} onChange={set(['colors', 'surfaceRaised'])} />
                  <ColorField label="Primary accent" value={get(['colors', 'primary'])} inherited={defaults[colorVar('primary')!]} onChange={set(['colors', 'primary'])} />
                  <ColorField label="Accent hover" value={get(['colors', 'primaryHover'])} inherited={defaults[colorVar('primaryHover')!]} onChange={set(['colors', 'primaryHover'])} />
                  <ColorField label="Accent soft" hint="link hover, numerals" value={get(['colors', 'primarySoft'])} inherited={defaults[colorVar('primarySoft')!]} onChange={set(['colors', 'primarySoft'])} />
                </div>
              </Panel>

              <Panel title="Text and rules">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField label="Primary text" value={get(['colors', 'textPrimary'])} inherited={defaults[colorVar('textPrimary')!]} onChange={set(['colors', 'textPrimary'])} />
                  <ColorField label="Body text" value={get(['colors', 'textBody'])} inherited={defaults[colorVar('textBody')!]} onChange={set(['colors', 'textBody'])} />
                  <ColorField label="Muted text" hint="labels and meta" value={get(['colors', 'textMuted'])} inherited={defaults[colorVar('textMuted')!]} onChange={set(['colors', 'textMuted'])} />
                  <ColorField label="Hairline" hint="section dividers" value={get(['colors', 'hairline'])} inherited={defaults[colorVar('hairline')!]} onChange={set(['colors', 'hairline'])} />
                  <ColorField label="Rule" hint="stronger borders" value={get(['colors', 'rule'])} inherited={defaults[colorVar('rule')!]} onChange={set(['colors', 'rule'])} />
                  <ColorField label="Selection" hint="highlighted text" value={get(['colors', 'selection'])} inherited={defaults[colorVar('selection')!]} onChange={set(['colors', 'selection'])} />
                  <ColorField label="Link" value={get(['colors', 'link'])} inherited={defaults[colorVar('link')!]} onChange={set(['colors', 'link'])} />
                  <ColorField label="Link hover" value={get(['colors', 'linkHover'])} inherited={defaults[colorVar('linkHover')!]} onChange={set(['colors', 'linkHover'])} />
                </div>
                <label className="mt-5 flex items-center gap-2.5 text-[14px] text-ash">
                  <input
                    type="checkbox"
                    checked={theme.linkUnderline === true}
                    onChange={(e) => setTheme((c) => ({ ...c, linkUnderline: e.target.checked || undefined }))}
                    className="h-4 w-4 accent-flare"
                  />
                  Underline links in rich text
                </label>
              </Panel>

              {/* Kept apart from the palette on purpose: these carry meaning
                  rather than brand, and wiring them to the accent would make a
                  "success" green stop meaning success. Empty follows the
                  shipped value, like every other field here. */}
              <Panel title="Status colours">
                <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
                  Used where a colour says something rather than decorates: an open or closed sign, a
                  notice, the filled half of a star. They are deliberately not tied to your accent —
                  change them only if they clash with your palette.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField label="Open · success" value={get(['status', 'success'])} inherited={STATUS_DEFAULTS.success} onChange={set(['status', 'success'])} />
                  <ColorField label="Warning" value={get(['status', 'warning'])} inherited={STATUS_DEFAULTS.warning} onChange={set(['status', 'warning'])} />
                  <ColorField label="Closed · danger" value={get(['status', 'danger'])} inherited={STATUS_DEFAULTS.danger} onChange={set(['status', 'danger'])} />
                  <ColorField label="Star rating" value={get(['status', 'rating'])} inherited={STATUS_DEFAULTS.rating} onChange={set(['status', 'rating'])} />
                </div>
              </Panel>

              <Panel title="Chart colours">
                <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
                  The six a chart cycles through, in order. The first follows your accent unless you
                  change it here.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {CHART_DEFAULTS.map((fallback, i) => (
                    <ColorField
                      key={i}
                      label={`Series ${i + 1}`}
                      value={(theme.chart ?? [])[i]}
                      inherited={fallback}
                      onChange={(next) => {
                        /* Held as a dense array: a gap would shift every later
                           series when the theme is read back. */
                        const series = [...(theme.chart ?? [])];
                        while (series.length < CHART_DEFAULTS.length) series.push(CHART_DEFAULTS[series.length]!);
                        series[i] = next ?? CHART_DEFAULTS[i]!;
                        const untouched = series.every((c, n) => c === CHART_DEFAULTS[n]);
                        setTheme((c) => ({ ...c, chart: untouched ? undefined : series }));
                      }}
                    />
                  ))}
                </div>
              </Panel>
            </>
          )}

          {tab === 'Typography' && (
            <>
              <Panel title="Role">
                <Field label="Editing" hint="each role maps to a tag or a named style on the public site">
                  <Select value={role} onChange={(e) => setRole(e.target.value as TypeRole)}>
                    {TYPE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {TYPE_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </Panel>

              <Panel title={`${TYPE_ROLE_LABELS[role]} — base`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChoiceField label="Font family" value={get(['typography', role, 'base', 'family']) as FontKey | undefined} groups={FONT_OPTIONS} onChange={set(['typography', role, 'base', 'family'])} />
                  <LengthField label="Font size" placeholder="e.g. 66px or clamp(36px, 7vw, 66px)" value={get(['typography', role, 'base', 'size'])} inherited={defaults[typeVar(role, 'size')]} onChange={set(['typography', role, 'base', 'size'])} />
                  <ChoiceField label="Font weight" value={get(['typography', role, 'base', 'weight']) as never} inherited={defaults[typeVar(role, 'weight')]} options={WEIGHT_OPTIONS} onChange={set(['typography', role, 'base', 'weight'])} />
                  <ChoiceField label="Font style" value={get(['typography', role, 'base', 'style']) as never} inherited={defaults[typeVar(role, 'style')]} options={STYLE_OPTIONS} onChange={set(['typography', role, 'base', 'style'])} />
                  <LengthField label="Line height" kind="lineHeight" placeholder="e.g. 1.2" value={get(['typography', role, 'base', 'lineHeight'])} inherited={defaults[typeVar(role, 'lineHeight')]} onChange={set(['typography', role, 'base', 'lineHeight'])} />
                  <LengthField label="Letter spacing" placeholder="e.g. -0.03em" value={get(['typography', role, 'base', 'letterSpacing'])} inherited={defaults[typeVar(role, 'letterSpacing')]} onChange={set(['typography', role, 'base', 'letterSpacing'])} />
                  <ColorField label="Colour" value={get(['typography', role, 'base', 'color'])} inherited={defaults[typeVar(role, 'color')]} onChange={set(['typography', role, 'base', 'color'])} />
                  <ChoiceField label="Text transform" value={get(['typography', role, 'base', 'transform']) as never} inherited={defaults[typeVar(role, 'transform')]} options={TRANSFORM_OPTIONS} onChange={set(['typography', role, 'base', 'transform'])} />
                  <ChoiceField label="Text decoration" value={get(['typography', role, 'base', 'decoration']) as never} inherited={defaults[typeVar(role, 'decoration')]} options={DECORATION_OPTIONS} onChange={set(['typography', role, 'base', 'decoration'])} />
                </div>
              </Panel>

              <Panel title={`${TYPE_ROLE_LABELS[role]} — by screen size`}>
                <p className="m-0 mb-4 text-[13px] text-smoke">
                  Each row applies at that width and below, and overrides the base above. An empty field shows the
                  value it inherits, greyed out. A fluid <code className="font-mono text-flare-soft">clamp()</code> base
                  size often removes the need for these entirely.
                </p>
                <div className="space-y-4">
                  {BREAKPOINTS.map((bp) => (
                    <div key={bp.key} className="grid gap-3 border-t-2 border-hairline pt-4 sm:grid-cols-3">
                      <div className="sm:col-span-3">
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
                          {bp.label} — {bp.maxWidth}px and below
                        </span>
                      </div>
                      <LengthField label="Font size" value={get(['typography', role, bp.key as BreakpointKey, 'size'])} inherited={get(['typography', role, 'base', 'size']) ?? defaults[typeVar(role, 'size')]} onChange={set(['typography', role, bp.key, 'size'])} />
                      <LengthField label="Line height" kind="lineHeight" value={get(['typography', role, bp.key as BreakpointKey, 'lineHeight'])} inherited={get(['typography', role, 'base', 'lineHeight']) ?? defaults[typeVar(role, 'lineHeight')]} onChange={set(['typography', role, bp.key, 'lineHeight'])} />
                      <LengthField label="Letter spacing" value={get(['typography', role, bp.key as BreakpointKey, 'letterSpacing'])} inherited={get(['typography', role, 'base', 'letterSpacing']) ?? defaults[typeVar(role, 'letterSpacing')]} onChange={set(['typography', role, bp.key, 'letterSpacing'])} />
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Kept out of the roles above because these are not a role:
                  they are the sizes the block components were drawn with, and
                  pointing them at the body role would move every intro
                  paragraph on every existing site by a pixel. */}
              <Panel title="Text inside blocks">
                <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
                  Paragraph sizes used by the blocks themselves — intros, card text, small print.
                  Empty keeps the size each block was drawn with.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <LengthField label="Intro and lead text" inherited={defaults['--he-block-lead']} value={get(['blockText', 'lead'])} onChange={set(['blockText', 'lead'])} />
                  <LengthField label="Standard" inherited={defaults['--he-block-text']} value={get(['blockText', 'text'])} onChange={set(['blockText', 'text'])} />
                  <LengthField label="Secondary" inherited={defaults['--he-block-small']} value={get(['blockText', 'small'])} onChange={set(['blockText', 'small'])} />
                </div>
              </Panel>

              <LocaleFonts set={set} get={get} />
            </>
          )}

          {tab === 'Buttons' && (
            <>
              <Panel title="Shared geometry">
                <div className="grid gap-4 sm:grid-cols-2">
                  <LengthField label="Corner radius" inherited={defaults['--he-btn-radius']} value={get(['buttons', 'radius'])} onChange={set(['buttons', 'radius'])} />
                  <LengthField label="Font size" inherited={defaults['--he-btn-size']} value={get(['buttons', 'fontSize'])} onChange={set(['buttons', 'fontSize'])} />
                  <LengthField label="Horizontal padding" inherited={defaults['--he-btn-px']} value={get(['buttons', 'paddingX'])} onChange={set(['buttons', 'paddingX'])} />
                  <LengthField label="Vertical padding" inherited={defaults['--he-btn-py']} value={get(['buttons', 'paddingY'])} onChange={set(['buttons', 'paddingY'])} />
                  <LengthField label="Letter spacing" inherited={defaults['--he-btn-tracking']} value={get(['buttons', 'letterSpacing'])} onChange={set(['buttons', 'letterSpacing'])} />
                  <ChoiceField label="Text transform" value={get(['buttons', 'transform']) as never} inherited={defaults['--he-btn-transform']} options={TRANSFORM_OPTIONS} onChange={set(['buttons', 'transform'])} />
                </div>
              </Panel>

              {BUTTON_VARIANTS.map((variant: ButtonVariant) => (
                <Panel key={variant} title={BUTTON_VARIANT_LABELS[variant]}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField label="Background" value={get(['buttons', variant, 'background'])} onChange={set(['buttons', variant, 'background'])} />
                    <ColorField label="Text" value={get(['buttons', variant, 'text'])} onChange={set(['buttons', variant, 'text'])} />
                    <ColorField label="Border" value={get(['buttons', variant, 'border'])} onChange={set(['buttons', variant, 'border'])} />
                    <LengthField label="Border width" hint="separate from the colour so the size never shifts by surprise" placeholder={variant === 'outline' ? '2px' : '0px'} value={get(['buttons', variant, 'borderWidth'])} onChange={set(['buttons', variant, 'borderWidth'])} />
                    <ColorField label="Background (hover)" value={get(['buttons', variant, 'hoverBackground'])} onChange={set(['buttons', variant, 'hoverBackground'])} />
                    <ColorField label="Text (hover)" value={get(['buttons', variant, 'hoverText'])} onChange={set(['buttons', variant, 'hoverText'])} />
                    <ColorField label="Border (hover)" value={get(['buttons', variant, 'hoverBorder'])} onChange={set(['buttons', variant, 'hoverBorder'])} />
                  </div>
                </Panel>
              ))}
            </>
          )}

          {tab === 'Layout' && (
            <>
            <Panel title="Page structure">
              <div className="grid gap-4 sm:grid-cols-2">
                <LengthField label="Container width" hint="the standard content column" placeholder="1200px" value={get(['layout', 'containerWidth'])} onChange={set(['layout', 'containerWidth'])} />
                <LengthField label="Gutter" hint="side padding at the widest breakpoint" placeholder="48px" value={get(['layout', 'gutter'])} onChange={set(['layout', 'gutter'])} />
                <LengthField label="Corner radius" hint="cards, panels and media" placeholder="0px" value={get(['layout', 'radius'])} onChange={set(['layout', 'radius'])} />
              </div>
            </Panel>

            {/* Site-wide versions of two controls each block also has in its
                own Design tab, which override these. */}
            <Panel title="Spacing and motion">
              <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
                Empty leaves every block with the spacing and timing it was drawn with — those differ
                between blocks on purpose. Setting one here changes all of them; a single block can
                still override it in its own Design tab.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <LengthField
                  label="Space between items"
                  hint="cards, tiles, list entries — not the spacing inside them"
                  value={get(['gap'])}
                  emptyLabel="each block's own"
                  onChange={set(['gap'])}
                />
                <Field label="Animation speed" hint="1 is normal; 0.5 is twice as fast">
                  <Select
                    value={theme.motion === undefined ? '' : String(theme.motion)}
                    onChange={(e) =>
                      setTheme((c) => ({ ...c, motion: e.target.value === '' ? undefined : Number(e.target.value) }))
                    }
                  >
                    <option value="">Normal</option>
                    <option value="0">Off — no animation anywhere</option>
                    <option value="0.5">Twice as fast</option>
                    <option value="0.75">A little faster</option>
                    <option value="1.5">A little slower</option>
                    <option value="2">Twice as slow</option>
                  </Select>
                </Field>
              </div>
            </Panel>
            </>
          )}

          {tab === 'Brand' && (
            <Panel title="Logo and favicon">
              <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                  label="Logo"
                  hint="the built-in placeholder mark, or an uploaded image"
                  value={theme.brand?.logoType}
                  options={[
                    { value: 'mark', label: 'Built-in mark' },
                    { value: 'image', label: 'Uploaded image' },
                  ]}
                  onChange={set(['brand', 'logoType'])}
                />
                <Field label="Wordmark text" hint="shown beside the built-in mark">
                  <Input
                    value={theme.brand?.wordmark ?? ''}
                    placeholder="Defaults to the site name"
                    onChange={(e) => setTheme((c) => setIn(c, ['brand', 'wordmark'], e.target.value || undefined))}
                  />
                </Field>
                <LengthField label="Logo height" placeholder="32px" value={get(['brand', 'logoHeight'])} onChange={set(['brand', 'logoHeight'])} />
                <LengthField label="Logo height (mobile)" placeholder="32px" value={get(['brand', 'logoHeightMobile'])} onChange={set(['brand', 'logoHeightMobile'])} />
              </div>

              <div className="mt-5 space-y-4 border-t-2 border-hairline pt-5">
                <MediaField label="Logo image" value={theme.brand?.logoUrl} onPick={() => setPicking('logo')} onClear={() => setTheme((c) => setIn(c, ['brand', 'logoUrl'], undefined))} />
                <MediaField label="Logo image (mobile)" value={theme.brand?.logoMobileUrl} onPick={() => setPicking('logoMobile')} onClear={() => setTheme((c) => setIn(c, ['brand', 'logoMobileUrl'], undefined))} />
                <MediaField label="Favicon" value={theme.brand?.faviconUrl} onPick={() => setPicking('favicon')} onClear={() => setTheme((c) => setIn(c, ['brand', 'faviconUrl'], undefined))} />
              </div>

              <label className="mt-5 flex items-center gap-2.5 text-[14px] text-ash">
                <input
                  type="checkbox"
                  checked={theme.brand?.showWordmark !== false}
                  onChange={(e) => setTheme((c) => setIn(c, ['brand', 'showWordmark'], e.target.checked ? undefined : false))}
                  className="h-4 w-4 accent-flare"
                />
                Show the wordmark beside the mark
              </label>
            </Panel>
          )}

          {tab === 'Header & menus' && (
            <>
              <Panel title="Header">
                <div className="space-y-5">
                  <VariantPicker<HeaderVariant>
                    label="Layout"
                    value={theme.chrome?.header?.variant}
                    fallback="classic"
                    options={HEADER_VARIANT_LABELS}
                    wireframes={HEADER_WIREFRAMES}
                    onChange={set(['chrome', 'header', 'variant'])}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ChoiceField
                      label="Switch to the menu button at"
                      hint="the widest screen that shows it"
                      value={theme.chrome?.header?.collapseAt}
                      options={[
                        { value: 'laptop', label: 'Desktop — 1440px and below' },
                        { value: 'tablet', label: 'Tablet — 1024px and below (default)' },
                        { value: 'mobile', label: 'Mobile — 768px and below' },
                      ]}
                      onChange={set(['chrome', 'header', 'collapseAt'])}
                    />
                    <Field label="Menu button label" hint="shown by the centred and pill headers">
                      <Input
                        value={theme.chrome?.header?.menuLabel ?? ''}
                        placeholder="Menu"
                        maxLength={20}
                        onChange={(e) => set(['chrome', 'header', 'menuLabel'])(e.target.value || undefined)}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Toggle label="Stick to the top while scrolling" value={theme.chrome?.header?.sticky} fallback onChange={set(['chrome', 'header', 'sticky'])} />
                    <Toggle label="Transparent over a full-width hero" value={theme.chrome?.header?.overlay} onChange={set(['chrome', 'header', 'overlay'])} />
                    <Toggle label="Show a search control" value={theme.chrome?.header?.search} onChange={set(['chrome', 'header', 'search'])} />
                    <Toggle label="Keep the header button on phones" value={theme.chrome?.header?.ctaOnMobile} onChange={set(['chrome', 'header', 'ctaOnMobile'])} />
                  </div>
                  {theme.chrome?.header?.variant === 'rail' && (
                    <ChoiceField
                      label="Menu button on the rail"
                      value={theme.chrome?.header?.railButton}
                      options={[
                        { value: 'top', label: 'At the top (default)' },
                        { value: 'center', label: 'In the middle' },
                      ]}
                      onChange={set(['chrome', 'header', 'railButton'])}
                    />
                  )}
                  {(theme.chrome?.header?.variant === 'sidebar' || theme.chrome?.header?.variant === 'rail') && (
                    <p className="m-0 text-[12px] text-smoke">
                      The sidebar and the rail sit beside the page from 1024px up; smaller screens get a top bar with the
                      menu button. Neither turns transparent, and the sidebar&apos;s dropdowns always open beside it.
                    </p>
                  )}
                  <p className="m-0 text-[12px] text-smoke">
                    The transparent header only turns transparent over a hero that runs to the top of the page; everywhere
                    else it stays solid.
                  </p>
                </div>
              </Panel>

              <Panel title="Desktop dropdowns">
                <VariantPicker<MegaVariant>
                  label="What a menu link with sub-items opens"
                  value={theme.chrome?.megaMenu}
                  fallback="compact"
                  options={MEGA_VARIANT_LABELS}
                  wireframes={MEGA_WIREFRAMES}
                  onChange={set(['chrome', 'megaMenu'])}
                />
                <p className="m-0 mt-3 text-[12px] text-smoke">
                  Sub-items with an image become cards; give sub-items a group in Menus to gather them under headings.
                </p>
              </Panel>

              <Panel title="Menu button">
                <div className="space-y-5">
                  <VariantPicker<MobileMenuVariant>
                    label="What the menu button opens"
                    value={theme.chrome?.mobileMenu?.variant}
                    fallback="drilldown"
                    options={MOBILE_MENU_LABELS}
                    wireframes={MOBILE_MENU_WIREFRAMES}
                    onChange={set(['chrome', 'mobileMenu', 'variant'])}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ChoiceField
                      label="Drawer side"
                      value={theme.chrome?.mobileMenu?.side}
                      options={[
                        { value: 'right', label: 'Right (default)' },
                        { value: 'left', label: 'Left' },
                      ]}
                      onChange={set(['chrome', 'mobileMenu', 'side'])}
                    />
                    <ChoiceField
                      label="Alignment"
                      value={theme.chrome?.mobileMenu?.align}
                      options={[
                        { value: 'left', label: 'Left (default)' },
                        { value: 'center', label: 'Centred' },
                      ]}
                      onChange={set(['chrome', 'mobileMenu', 'align'])}
                    />
                    <ChoiceField
                      label="Buttons sit"
                      value={theme.chrome?.mobileMenu?.ctaPosition}
                      options={[
                        { value: 'top', label: 'At the top (default)' },
                        { value: 'bottom', label: 'Pinned to the bottom' },
                      ]}
                      onChange={set(['chrome', 'mobileMenu', 'ctaPosition'])}
                    />
                  </div>
                  <Toggle label="Large menu type" value={theme.chrome?.mobileMenu?.largeType} onChange={set(['chrome', 'mobileMenu', 'largeType'])} />
                </div>
              </Panel>

              <Panel title="Announcement ribbon">
                <div className="space-y-4">
                  <Toggle label="Show an announcement above the header" value={theme.chrome?.announcement?.enabled} onChange={set(['chrome', 'announcement', 'enabled'])} />
                  <Field label="Text">
                    <Input
                      value={theme.chrome?.announcement?.text ?? ''}
                      maxLength={160}
                      onChange={(e) => set(['chrome', 'announcement', 'text'])(e.target.value || undefined)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Link label">
                      <Input
                        value={theme.chrome?.announcement?.linkLabel ?? ''}
                        placeholder="Learn more"
                        maxLength={40}
                        onChange={(e) => set(['chrome', 'announcement', 'linkLabel'])(e.target.value || undefined)}
                      />
                    </Field>
                    <Field
                      label="Link"
                      error={
                        theme.chrome?.announcement?.href && !isSafeHref(theme.chrome.announcement.href)
                          ? 'Use a path like /offers or a full https:// URL.'
                          : undefined
                      }
                    >
                      <Input
                        value={theme.chrome?.announcement?.href ?? ''}
                        placeholder="/offers"
                        spellCheck={false}
                        onChange={(e) => set(['chrome', 'announcement', 'href'])(e.target.value.trim() || undefined)}
                      />
                    </Field>
                  </div>
                  <Toggle label="Visitors can dismiss it" value={theme.chrome?.announcement?.dismissible} fallback onChange={set(['chrome', 'announcement', 'dismissible'])} />
                </div>
              </Panel>
            </>
          )}

          {tab === 'Footer' && (
            <Panel title="Footer">
              <div className="space-y-5">
                <VariantPicker<FooterVariant>
                  label="Layout"
                  value={theme.chrome?.footer?.variant}
                  fallback="sitemap"
                  options={FOOTER_VARIANT_LABELS}
                  wireframes={FOOTER_WIREFRAMES}
                  onChange={set(['chrome', 'footer', 'variant'])}
                />
                <Toggle label='Show a "Share this page" chip (inset card footer)' value={theme.chrome?.footer?.shareChip} onChange={set(['chrome', 'footer', 'shareChip'])} />
                <p className="m-0 text-[12px] text-smoke">
                  Columns, social links and the address are edited in Menus; the name, tagline and email in Settings.
                </p>
              </div>
            </Panel>
          )}

          {tab === 'Blog' && (
            <>
              <Panel title="Post lists">
                <div className="space-y-5">
                  <VariantPicker<BlogIndexLayout>
                    label="How the blog, category and research pages list posts"
                    value={theme.blog?.index}
                    fallback="grid"
                    options={BLOG_INDEX_LABELS}
                    wireframes={BLOG_INDEX_WIREFRAMES}
                    onChange={set(['blog', 'index'])}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ChoiceField
                      label="Show"
                      hint="every layout except the card grid"
                      value={theme.blog?.pagination}
                      options={[
                        { value: 'none', label: 'All at once (default)' },
                        { value: 'more', label: 'A few, then “Show more”' },
                        { value: 'pages', label: 'A page at a time, numbered' },
                      ]}
                      onChange={set(['blog', 'pagination'])}
                    />
                    <Field label="Posts per page" hint="when shown a few at a time">
                      <Input
                        type="number"
                        min={2}
                        max={24}
                        placeholder="9"
                        value={theme.blog?.perPage ?? ''}
                        onChange={(e) =>
                          set(['blog', 'perPage'])(e.target.value === '' ? undefined : Math.min(24, Math.max(2, Math.round(Number(e.target.value) || 2))))
                        }
                      />
                    </Field>
                  </div>
                  <p className="m-0 text-[12px] text-smoke">
                    A Blog page built in Pages keeps its own blocks. This sets the list on the blog when there is no such
                    page, and on every category and research page.
                  </p>
                </div>
              </Panel>
              <Panel title="Archive pages">
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Posts per archive page"
                      hint="each page is its own address — /blog/page/2 — rendered on the server"
                    >
                      <Input
                        type="number"
                        min={1}
                        max={MAX_ARCHIVE_PER_PAGE}
                        placeholder={`${LEGACY_INDEX_PER_PAGE} on the blog, ${LEGACY_ARCHIVE_PER_PAGE} elsewhere`}
                        value={theme.blog?.archivePerPage ?? ''}
                        onChange={(e) =>
                          set(['blog', 'archivePerPage'])(
                            e.target.value === ''
                              ? undefined
                              : Math.min(MAX_ARCHIVE_PER_PAGE, Math.max(1, Math.round(Number(e.target.value) || 1))),
                          )
                        }
                      />
                    </Field>
                    <ChoiceField
                      label="Links to the other pages"
                      value={theme.blog?.archivePager}
                      options={ARCHIVE_PAGERS.map((value) => ({
                        value,
                        label: `${ARCHIVE_PAGER_LABELS[value]}${value === 'numbers' ? ' (default)' : ''}`,
                      }))}
                      onChange={set(['blog', 'archivePager'])}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-ash">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-flare"
                      checked={theme.blog?.resultCount === true}
                      onChange={(e) => set(['blog', 'resultCount'])(e.target.checked ? true : undefined)}
                    />
                    Say how many there are — “Showing 1–12 of 110 results”
                  </label>
                  <p className="m-0 text-[12px] text-smoke">
                    “Load more” is a link to the next page with a script on top, so it works without one. Where the blog
                    lives, and what the page word is, are under Permalinks.
                  </p>
                </div>
              </Panel>
              <Panel title="Single post">
                <VariantPicker<BlogPostLayout>
                  label="How a post opens"
                  value={theme.blog?.post}
                  fallback="standard"
                  options={BLOG_POST_LABELS}
                  wireframes={BLOG_POST_WIREFRAMES}
                  onChange={set(['blog', 'post'])}
                />
                <p className="m-0 mt-3 text-[12px] text-smoke">A post without a cover image always uses the standard layout.</p>
                <label className="mt-4 flex items-center gap-2 text-[13px] text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={theme.blog?.progress === true}
                    onChange={(e) => set(['blog', 'progress'])(e.target.checked ? true : undefined)}
                  />
                  Show a reading-progress bar across the top of the screen on posts
                </label>
              </Panel>
              <PostFeaturesPanel blog={theme.blog} set={set} />
              <ArchiveFeaturesPanel blog={theme.blog} set={set} />
            </>
          )}

          {tab === 'Site-wide' && (
            <>
              <Panel title="Visitor controls">
                <div className="space-y-3">
                  <Toggle label="Back-to-top button" value={theme.chrome?.backToTop} onChange={set(['chrome', 'backToTop'])} />
                  <Toggle label="Reduce-motion switch in the footer" value={theme.chrome?.motionToggle} onChange={set(['chrome', 'motionToggle'])} />
                  <Toggle label="Let visitors switch to the alternate colours" value={theme.chrome?.themeToggle} onChange={set(['chrome', 'themeToggle'])} />
                </div>
              </Panel>

              {theme.chrome?.themeToggle && (
                <Panel title="Alternate colours">
                  <p className="m-0 mb-4 text-[13px] text-smoke">
                    What the switch changes to — usually a light version of a dark site, or the reverse. Anything left empty
                    keeps the main palette.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField label="Page background" value={get(['colorsAlt', 'background'])} onChange={set(['colorsAlt', 'background'])} />
                    <ColorField label="Raised surface" value={get(['colorsAlt', 'surface'])} onChange={set(['colorsAlt', 'surface'])} />
                    <ColorField label="Third surface" value={get(['colorsAlt', 'surfaceRaised'])} onChange={set(['colorsAlt', 'surfaceRaised'])} />
                    <ColorField label="Primary text" value={get(['colorsAlt', 'textPrimary'])} onChange={set(['colorsAlt', 'textPrimary'])} />
                    <ColorField label="Body text" value={get(['colorsAlt', 'textBody'])} onChange={set(['colorsAlt', 'textBody'])} />
                    <ColorField label="Muted text" value={get(['colorsAlt', 'textMuted'])} onChange={set(['colorsAlt', 'textMuted'])} />
                    <ColorField label="Primary accent" value={get(['colorsAlt', 'primary'])} onChange={set(['colorsAlt', 'primary'])} />
                    <ColorField label="Hairline" value={get(['colorsAlt', 'hairline'])} onChange={set(['colorsAlt', 'hairline'])} />
                    <ColorField label="Rule" value={get(['colorsAlt', 'rule'])} onChange={set(['colorsAlt', 'rule'])} />
                  </div>
                </Panel>
              )}

              <Panel title="Region suggestion bar">
                <div className="space-y-4">
                  <Toggle label="Suggest another regional or language site" value={theme.chrome?.regionBar?.enabled} onChange={set(['chrome', 'regionBar', 'enabled'])} />
                  <Field label="Message">
                    <Input
                      value={theme.chrome?.regionBar?.message ?? ''}
                      maxLength={200}
                      placeholder="You are visiting our international site. Choose your region for local information."
                      onChange={(e) => set(['chrome', 'regionBar', 'message'])(e.target.value || undefined)}
                    />
                  </Field>
                  <Field label="Button label">
                    <Input
                      value={theme.chrome?.regionBar?.buttonLabel ?? ''}
                      placeholder="Continue"
                      maxLength={30}
                      onChange={(e) => set(['chrome', 'regionBar', 'buttonLabel'])(e.target.value || undefined)}
                    />
                  </Field>
                  <div>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Regions</div>
                    <div className="space-y-2">
                      {(theme.chrome?.regionBar?.options ?? []).map((option, i, all) => (
                        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                          <Input
                            value={option.label}
                            placeholder="United Kingdom"
                            onChange={(e) =>
                              set(['chrome', 'regionBar', 'options'])(all.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))
                            }
                          />
                          <Input
                            value={option.href}
                            placeholder="https://example.co.uk"
                            spellCheck={false}
                            onChange={(e) =>
                              set(['chrome', 'regionBar', 'options'])(all.map((o, j) => (j === i ? { ...o, href: e.target.value.trim() } : o)))
                            }
                          />
                          <AdminButton
                            variant="ghost"
                            onClick={() => {
                              const next = all.filter((_, j) => j !== i);
                              set(['chrome', 'regionBar', 'options'])(next.length ? next : undefined);
                            }}
                            aria-label={`Remove ${option.label || 'region'}`}
                          >
                            ×
                          </AdminButton>
                        </div>
                      ))}
                    </div>
                    <AdminButton
                      variant="secondary"
                      className="mt-3"
                      onClick={() =>
                        set(['chrome', 'regionBar', 'options'])([...(theme.chrome?.regionBar?.options ?? []), { label: '', href: '' }])
                      }
                    >
                      Add region
                    </AdminButton>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Panel title="Preview">
            <style dangerouslySetInnerHTML={{ __html: previewCss }} />
            <div className="he-preview he-site space-y-3 border-2 border-hairline bg-ink p-4">
              <p className="type-eyebrow m-0">Eyebrow label</p>
              <h1 className="m-0">Heading one</h1>
              <h2 className="m-0">Heading two</h2>
              <h3 className="m-0">Heading three</h3>
              <p className="type-lede m-0">The lede paragraph that opens a section.</p>
              <p className="m-0">
                Body copy, the size most of the page is set in, with{' '}
                <span className="text-flare-soft">an inline accent</span>.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="he-btn he-btn-primary">Primary</span>
                <span className="he-btn he-btn-outline">Outline</span>
                <span className="he-btn he-btn-ghost">Ghost</span>
              </div>
            </div>
            <p className="m-0 mt-3 text-[12px] text-smoke">
              Base values only — the per-screen overrides apply at real viewport widths.
            </p>
          </Panel>

          {dirty && (
            <div className="mt-4">
              <Alert tone="info">Unsaved changes. Nothing is live until you save.</Alert>
            </div>
          )}
        </aside>
      </div>

      <MediaPicker
        open={picking !== null}
        accept="image"
        onClose={() => setPicking(null)}
        onSelect={(media) => {
          const key = picking === 'favicon' ? 'faviconUrl' : picking === 'logoMobile' ? 'logoMobileUrl' : 'logoUrl';
          setTheme((c) => setIn(c, ['brand', key], media.url));
          setPicking(null);
        }}
      />
    </>
  );
}

function MediaField({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string;
  value: string | undefined;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {value ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={value} alt="" className="h-10 w-10 shrink-0 border-2 border-hairline bg-ink object-contain p-1" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-dashed border-hairline text-[10px] text-smoke">
            None
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-smoke">{value ?? 'Not set'}</span>
        <AdminButton variant="ghost" onClick={onPick}>
          Choose
        </AdminButton>
        {value && (
          <AdminButton variant="ghost" onClick={onClear}>
            Clear
          </AdminButton>
        )}
      </div>
    </Field>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Fonts by language
   ───────────────────────────────────────────────────────────────────────────
   Renders nothing on a site that speaks one language, which is most of them.

   The warnings are the point of the panel. A face that has no Armenian glyphs
   does not fail loudly — the browser substitutes whatever the device has, and
   the page looks *nearly* right, which is how it ships. So the screen says it
   before anybody has to notice it on a phone.
   ═══════════════════════════════════════════════════════════════════════════ */

function LocaleFonts({
  set,
  get,
}: {
  set: (path: Path) => (value: unknown) => void;
  get: (path: Path) => string | undefined;
}) {
  const config = localeConfig();
  if (!config.multilingual) return null;

  const roles = [
    ['display', 'Headings'],
    ['sans', 'Body text'],
    ['mono', 'Labels'],
  ] as const;

  return (
    <Panel title="Fonts by language">
      <p className="m-0 mb-4 max-w-[70ch] text-[13px] leading-relaxed text-ash">
        The palette and the layout are one design in every language. A typeface is the exception: a face with no
        glyphs for an alphabet is not a design choice being overridden, it is a page falling back to whatever the
        reader&rsquo;s device has. Leave a language blank to use the site&rsquo;s own fonts.
      </p>

      <div className="flex flex-col gap-5">
        {config.locales.map((locale) => {
          const language = localeName(locale);
          return (
            <div key={locale} className="border-t-2 border-hairline pt-4 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-flare">{locale}</span>
                <span className="text-[14px] text-bone">{language}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-smoke">
                  {SCRIPT_LABELS[scriptFor(locale)]}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {roles.map(([role, label]) => {
                  const chosen = get(['localeFonts', locale, role]) as FontKey | undefined;
                  const warning = chosen ? fontWarning(chosen, locale) : null;
                  return (
                    <div key={role}>
                      <ChoiceField
                        label={label}
                        value={chosen}
                        groups={FONT_GROUPS}
                        onChange={set(['localeFonts', locale, role])}
                      />
                      {warning && (
                        <p className="m-0 mt-1.5 border-l-2 border-amber-400 pl-2.5 text-[12px] leading-relaxed text-amber-400">
                          {warningText(warning, language)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* The engine ships three Latin-only faces, so on a non-Latin site every
          choice above warns until a subset is added. Saying where to add one
          is more use than repeating the warning. */}
      <p className="m-0 mt-5 max-w-[70ch] text-[12px] leading-relaxed text-smoke">
        Adding real coverage means adding a subset file — see{' '}
        <code className="font-mono text-flare-soft">docs/fonts.md</code>.
      </p>
    </Panel>
  );
}
