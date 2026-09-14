/* ═══════════════════════════════════════════════════════════════════════════
   Roles — the one place the list lives
   ───────────────────────────────────────────────────────────────────────────
   This file imports nothing, deliberately. `rbac.ts` is `server-only`, so the
   admin screens cannot import from it, and before this module existed the same
   five-member union was hand-written in seven files — adding a role meant
   editing all seven, and the type unions would simply disagree if one were
   missed rather than failing the build.

   The one copy that remains is the Postgres enum in `server/db/schema.ts`.
   That file is read by drizzle-kit's own loader rather than by Next, and it
   imports nothing through the `@/*` alias, so pulling this in there would bet
   `db:generate` on a resolver we have not verified. `tests/roles.test.ts`
   holds the two together instead.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Every role, in order of authority. The order is the Postgres enum's order
 * too, so it is not arbitrary — see `userRole` in `server/db/schema.ts`.
 */
export const ROLES = ['admin', 'manager', 'editor', 'author', 'reviewer'] as const;

export type Role = (typeof ROLES)[number];

/** Narrow an untrusted string — a JWT claim, a form field — to a real role. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * What each role can do, in the words of somebody choosing one.
 *
 * Listed from least authority to most, which is the order the picker shows and
 * the opposite of `ROLES` — a list you scroll through should start with the
 * safe choice, not the dangerous one.
 */
export const ROLE_CHOICES: { value: Role; label: string; hint: string }[] = [
  { value: 'reviewer', label: 'Reviewer', hint: 'reads the site and handles enquiries; changes nothing' },
  { value: 'author', label: 'Author', hint: 'writes their own pages and posts, but cannot publish' },
  { value: 'editor', label: 'Editor', hint: 'writes and publishes their own content' },
  { value: 'manager', label: 'Manager', hint: 'all content, plus the theme, menus, popups and redirects' },
  { value: 'admin', label: 'Administrator', hint: 'everything, including accounts, security and backups' },
];

/** The label for a stored role, for screens that show one without a picker. */
export function roleLabel(role: Role): string {
  return ROLE_CHOICES.find((choice) => choice.value === role)?.label ?? role;
}
