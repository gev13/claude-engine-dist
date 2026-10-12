'use client';

import { useRef, useState } from 'react';
import { useMessages } from '@/components/site/Messages';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   3.29 — a file field drawn as a drop zone
   ───────────────────────────────────────────────────────────────────────────
   The native input stays in the form — it is what the form posts, what the
   label points at and what a keyboard or a screen reader operates — but it is
   visually hidden, and the zone around it takes a dropped file too. Once a
   file is chosen the zone says so and offers "Change".

   A dropped file is put into the input through a DataTransfer, so the form's
   own FormData still finds it; the caller's `onFile` checks its type and size
   exactly as for a picked one, and can refuse it.
   ═══════════════════════════════════════════════════════════════════════════ */

export function FileDrop({
  id,
  name,
  required,
  accept,
  describedBy,
  dropText,
  hint,
  onFile,
}: {
  id: string;
  name: string;
  required?: boolean;
  accept: string;
  describedBy?: string;
  /** "Drop your CV here"; unset is the engine's words. */
  dropText?: string;
  /** The accepted kinds, under the button. */
  hint?: string;
  /** Called with the chosen file (or null when cleared); returns false to refuse it. */
  onFile: (file: File | null) => boolean | void;
}) {
  const t = useMessages();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);

  const take = (next: File | null) => {
    if (onFile(next) === false) {
      if (input.current) input.current.value = '';
      setFile(null);
      return;
    }
    setFile(next);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped || !input.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    input.current.files = transfer.files;
    take(dropped);
  };

  return (
    <div
      className={cn('he-fdrop', over && 'is-over', file && 'has-file')}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        required={required}
        accept={accept}
        aria-describedby={describedBy}
        className="he-fdrop__input"
        onChange={(event) => take(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <span className="he-fdrop__small">{t('form.uploaded')}</span>
          <span className="he-fdrop__name">{file.name}</span>
          <button type="button" className="he-cbtn is-outline is-small he-fdrop__btn" onClick={() => input.current?.click()}>
            {t('form.change')}
          </button>
        </>
      ) : (
        <>
          <span className="he-fdrop__lead">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
              <path d="M12 17v-6M9.5 13.5L12 11l2.5 2.5" />
            </svg>
            {dropText || t('form.dropFile')}
          </span>
          <span className="he-fdrop__small">{t('form.or')}</span>
          <button type="button" className="he-cbtn is-outline is-small he-fdrop__btn" onClick={() => input.current?.click()}>
            {t('form.browse')}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l6-6M4 3h5v5" />
            </svg>
          </button>
          {hint && <span className="he-fdrop__hint">{hint}</span>}
        </>
      )}
    </div>
  );
}
