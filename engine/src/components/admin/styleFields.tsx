'use client';

import { Field, Input, Select } from '@/components/admin/ui';
import { isColor, isLength, isLineHeight, normaliseLength } from '@/lib/theme';
import { cn } from '@/lib/utils';

/* Small controls shared by every tab of the Appearance screen.

   All three follow the same contract: an empty string means "not set", and a
   value that would fail the theme schema is flagged here rather than at save,
   so an editor sees the problem beside the field they typed it in.

   Each also takes `inherited`: the value that applies while the field is
   empty. "inherit" on its own is true and useless — an editor cannot tell
   whether the heading they are about to change is 40px or 66px — so where the
   caller knows the answer, the field shows it rather than the word. */

export function ColorField({
  label,
  hint,
  value,
  inherited,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  /** The colour in force while this field is empty. */
  inherited?: string;
  onChange: (next: string | undefined) => void;
}) {
  const current = value ?? '';
  const invalid = current !== '' && !isColor(current);

  // The swatch showed black for every unset colour, which read as a *choice*
  // of black. Falling back to the inherited colour makes it show what is
  // actually on the page.
  const shown = /^#[0-9a-fA-F]{6}$/.test(current)
    ? current
    : inherited && /^#[0-9a-fA-F]{6}$/.test(inherited)
      ? inherited
      : '#000000';

  return (
    <Field label={label} hint={hint} error={invalid ? 'Use a hex, rgb() or hsl() colour.' : undefined}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-9 w-10 shrink-0 cursor-pointer border-2 bg-ink p-0.5',
            current === '' ? 'border-dashed border-smoke' : 'border-hairline',
          )}
        />
        <Input
          value={current}
          placeholder={inherited || 'inherit'}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
        />
        {current !== '' && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 border-2 border-hairline px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke hover:text-bone"
          >
            Clear
          </button>
        )}
      </div>
    </Field>
  );
}

export function LengthField({
  label,
  hint,
  placeholder,
  value,
  inherited,
  onChange,
  kind = 'length',
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string | undefined;
  /** The value in force while this field is empty. */
  inherited?: string;
  onChange: (next: string | undefined) => void;
  kind?: 'length' | 'lineHeight';
}) {
  const current = value ?? '';
  const check = kind === 'lineHeight' ? isLineHeight : isLength;
  const invalid = current !== '' && !check(current);

  return (
    <Field
      label={label}
      hint={hint}
      error={
        invalid
          ? kind === 'lineHeight'
            ? 'Use a ratio (1.4) or a length (24px).'
            : 'Use a length such as 16px, 1.2rem or clamp(20px, 3vw, 40px).'
          : undefined
      }
    >
      <Input
        value={current}
        // An explicit placeholder is guidance the caller wrote ("e.g. 66px");
        // the inherited value is a fact, so it comes first.
        placeholder={inherited || placeholder || 'inherit'}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.trim() || undefined)}
        /* `56` becomes `56px` as you leave the field. The schema does this
           anyway, but doing it here as well means the value on screen is the
           value that ships — a field that silently rewrote what you typed
           would be worse than one that never accepted it. */
        onBlur={(e) => {
          if (kind === 'lineHeight') return;
          const filled = normaliseLength(e.target.value.trim());
          if (filled && filled !== e.target.value.trim()) onChange(filled);
        }}
      />
      {inherited && placeholder && current === '' && (
        <p className="m-0 mt-1 text-[11px] text-smoke">{placeholder}</p>
      )}
    </Field>
  );
}

export function ChoiceField<T extends string>({
  label,
  hint,
  value,
  options,
  groups,
  inherited,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T | undefined;
  options?: readonly { value: T; label: string }[];
  /**
   * Options under headings, for a list long enough that a flat one stops
   * being a menu — sixty typefaces, say.
   */
  groups?: readonly { label: string; options: readonly { value: T; label: string }[] }[];
  /** The value in force while nothing is chosen. */
  inherited?: string;
  onChange: (next: T | undefined) => void;
}) {
  const flat = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  // Name the default rather than calling it "Default": the list already holds
  // the value, so showing which one is in force costs a lookup and nothing else.
  const named = inherited && flat.find((o) => o.value === inherited)?.label;

  return (
    <Field label={label} hint={hint}>
      <Select value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
        <option value="">{named ? `Default — ${named}` : inherited ? `Default — ${inherited}` : 'Default'}</option>
        {groups
          ? groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))
          : flat.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
      </Select>
    </Field>
  );
}
