'use client';

import { Field, Input, Select } from '@/components/admin/ui';
import { isColor, isLength, isLineHeight } from '@/lib/theme';

/* Small controls shared by every tab of the Appearance screen.

   All three follow the same contract: an empty string means "not set", and a
   value that would fail the theme schema is flagged here rather than at save,
   so an editor sees the problem beside the field they typed it in. */

export function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  const current = value ?? '';
  const invalid = current !== '' && !isColor(current);

  return (
    <Field label={label} hint={hint} error={invalid ? 'Use a hex, rgb() or hsl() colour.' : undefined}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          // A picker cannot represent "unset", so it shows the placeholder
          // black until a real value exists.
          value={/^#[0-9a-fA-F]{6}$/.test(current) ? current : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer border-2 border-hairline bg-ink p-0.5"
        />
        <Input
          value={current}
          placeholder="inherit"
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
  onChange,
  kind = 'length',
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string | undefined;
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
        placeholder={placeholder ?? 'inherit'}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.trim() || undefined)}
      />
    </Field>
  );
}

export function ChoiceField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (next: T | undefined) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
        <option value="">Default</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
