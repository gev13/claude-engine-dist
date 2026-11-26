import { isColor, isLength, type Theme } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   3.37 — the fields' placeholder and a text box's own corners, top padding
   and grip (`theme.fields`), for every form the engine draws: the form
   block, the careers application form (both `.he-fb__input`), the
   newsletter block and the footer sign-up (`.he-nl__input`), the search
   block (`.he-srch__input`), the blog search (`.he-field`) and the contact
   form block, whose fields carry `.he-cf__input` only while one of these is
   set (`fieldsReachContact`). Nothing is written for nothing set.
   ═══════════════════════════════════════════════════════════════════════════ */

type Fields = NonNullable<Theme['fields']>;
type Decl = [string, string];

const PLACEHOLDER_KEYS = ['placeholder', 'placeholderTracking', 'textareaRadius', 'textareaPaddingTop', 'textareaResize'] as const;

/** Whether the theme sets anything here — the contact form block then marks its fields. */
export function fieldsReachContact(fields: Theme['fields']): boolean {
  return Boolean(fields && PLACEHOLDER_KEYS.some((key) => fields[key] !== undefined));
}

const clean = (value: unknown, check: (v: string) => boolean): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Checked again here, as everything that reaches a <style> element is.
  return trimmed && !/[<>{};@\\]/.test(trimmed) && check(trimmed) ? trimmed : null;
};

const rule = (selector: string, decls: Decl[]) => (decls.length ? `${selector}{${decls.map(([p, v]) => `${p}:${v}`).join(';')}}` : '');

/** Rules for the placeholder and the text box, under `scope` (`''` on the site, `.preview ` in the admin). */
export function fieldsExtraCss(fields: Fields, scope: string): string {
  const out: string[] = [];

  const hint: Decl[] = [];
  const colour = clean(fields.placeholder, isColor);
  if (colour) hint.push(['color', colour]);
  const tracking = clean(fields.placeholderTracking, isLength);
  if (tracking) hint.push(['letter-spacing', tracking]);
  if (hint.length) {
    out.push(rule(`${scope}:is(input.he-fb__input,textarea.he-fb__input,.he-nl__input,.he-srch__input,.he-field,.he-cf__input)::placeholder`, hint));
    // The several-choice drop-down's "Choose…" is its placeholder.
    out.push(rule(`${scope}.he-fb__multival.is-empty`, hint));
  }

  const box: Decl[] = [];
  const radius = clean(fields.textareaRadius, isLength);
  if (radius) box.push(['border-radius', radius]);
  const top = clean(fields.textareaPaddingTop, isLength);
  if (top) box.push(['padding-top', top]);
  if (fields.textareaResize === 'none' || fields.textareaResize === 'vertical') box.push(['resize', fields.textareaResize]);
  // As specific as the fields' corners rule (`input.he-fb__input:not([type=file])`) and after it, so a text box's own corners win.
  if (box.length) out.push(rule(`${scope}textarea:is(.he-fb__input,.he-cf__input):not([type=file])`, box));

  return out.join('');
}
