import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   3.29 — how the careers pages are drawn (Appearance → Careers)
   ───────────────────────────────────────────────────────────────────────────
   Stored in the theme row as `careers`. Every option unset draws the pages
   exactly as before: a list of rows, the standard advert, labelled fields.
   ═══════════════════════════════════════════════════════════════════════════ */

export const careersLookSchema = z.object({
  /** The listing: rows (as before) or cards in a grid. */
  list: z.enum(['rows', 'cards']).optional(),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  /** Cards: "LOCATION · WORKING TIME" above the title, and a button to the advert. */
  kicker: z.boolean().optional(),
  button: z.boolean().optional(),
  /** The advert: standard (as before) or the cover beside a panel holding the details, the text and the form. */
  page: z.enum(['standard', 'aside']).optional(),
  /** An icon beside each detail. */
  icons: z.boolean().optional(),
  /** The application form: labels above the fields (as before) or the words inside them; the CV as a drop zone. */
  form: z.enum(['labels', 'placeholders']).optional(),
  dropZone: z.boolean().optional(),
  /** After applying: "Back to the homepage" and "Explore other jobs" under the thanks. */
  doneButtons: z.boolean().optional(),
  /** A saved block shown after every advert — a closing band, say. */
  afterSavedBlock: z.string().uuid().optional(),
});

export type CareersLook = z.infer<typeof careersLookSchema>;

export type ResolvedCareersLook = {
  list: 'rows' | 'cards';
  columns: 2 | 3;
  kicker: boolean;
  button: boolean;
  page: 'standard' | 'aside';
  icons: boolean;
  form: 'labels' | 'placeholders';
  dropZone: boolean;
  doneButtons: boolean;
  afterSavedBlock?: string;
};

export function resolveCareersLook(look: CareersLook | undefined): ResolvedCareersLook {
  return {
    list: look?.list ?? 'rows',
    columns: look?.columns ?? 3,
    kicker: look?.kicker === true,
    button: look?.button === true,
    page: look?.page ?? 'standard',
    icons: look?.icons === true,
    form: look?.form ?? 'labels',
    dropZone: look?.dropZone === true,
    doneButtons: look?.doneButtons === true,
    afterSavedBlock: look?.afterSavedBlock,
  };
}
