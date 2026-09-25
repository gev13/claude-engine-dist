'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Search submits as a normal GET so results are shareable, linkable and
 * server-rendered — the canonical for any `?q=` view points back at the blog
 * index, so these pages never compete with it in search results. `action` is
 * the index's address, which is a setting (Permalinks) since 2.13.
 */
export function BlogSearch({
  initialQuery,
  action,
  labels,
}: {
  initialQuery: string;
  action: string;
  labels: { label: string; placeholder: string; submit: string; clear: string };
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `${action}?q=${encodeURIComponent(q)}` : action);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="blog-search" className="label-mono">
        {labels.label}
      </label>
      <input
        id="blog-search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={labels.placeholder}
        className="he-field min-w-0 flex-1 border-2 border-hairline bg-surface px-4 py-2.5 text-[15px] text-bone transition-colors placeholder:text-smoke focus:border-flare focus:outline-none sm:max-w-[420px]"
      />
      <button
        type="submit"
        className="he-chip border-2 border-flare bg-flare px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bone transition-colors hover:bg-flare-hot hover:text-ink"
      >
        {labels.submit}
      </button>
      {initialQuery && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            router.push(action);
          }}
          className="cursor-pointer bg-transparent px-2 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
        >
          {labels.clear}
        </button>
      )}
    </form>
  );
}
