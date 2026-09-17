'use client';

import { useState } from 'react';
import { CSS_MAX, cssWasChanged } from '@/lib/customCode';
import { Panel, Textarea } from './ui';

/* ═══════════════════════════════════════════════════════════════════════════
   One page's or post's own CSS
   ───────────────────────────────────────────────────────────────────────────
   The other half of the block Design tab's "CSS class" field: name a block
   there, aim at it here. Collapsed by default, because a page nobody has
   styled should not have a code editor sitting open in its sidebar.
   ═══════════════════════════════════════════════════════════════════════════ */

export function CustomCssPanel({
  value,
  onChange,
  what,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 'page' or 'post' — only used in the sentence shown while it is collapsed. */
  what: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Panel
      title="Custom CSS"
      actions={
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          className="cursor-pointer bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
        >
          {open ? 'Hide' : 'Edit'}
        </button>
      }
    >
      {open ? (
        <div className="grid gap-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, CSS_MAX))}
            rows={10}
            spellCheck={false}
            aria-label="Custom CSS for this page"
            placeholder={'.my-class {\n  background: #101014;\n}'}
            className="font-mono text-[12px] leading-relaxed"
          />
          <p className="m-0 text-[12px] leading-relaxed text-ash">
            Loaded on this {what} only, after the site&rsquo;s own CSS. Give a block a name in its
            Design tab under <span className="text-smoke">CSS class</span>, then aim at it here.
          </p>
          {cssWasChanged(value) && (
            <p className="m-0 text-[12px] leading-relaxed text-flare-soft">
              <code>@import</code> and anything that could close the style element are removed when
              this is saved. The rest is kept.
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 text-[13px] leading-relaxed text-ash">
          {value.trim()
            ? `${value.trim().split('\n').length} lines of CSS load with this ${what}.`
            : `Styles for this ${what} alone. Site-wide CSS lives in Custom code.`}
        </p>
      )}
    </Panel>
  );
}
