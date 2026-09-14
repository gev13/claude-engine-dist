import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The audit log stands alone
   ───────────────────────────────────────────────────────────────────────────
   Found while building restores: `audit_log.actor_id` referenced `users` with
   ON DELETE SET NULL, while 0001 makes the table append-only. Deleting any
   account that had ever done anything therefore failed — Postgres tried to
   null the column, the trigger refused the UPDATE, and the delete went with
   it. Restoring a backup hit the same wall on the users table.

   These are source-level checks rather than database ones, so they run in the
   ordinary suite with no connection: the point is that nobody reintroduces
   the reference by writing the obvious `.references(...)` back.
   ═══════════════════════════════════════════════════════════════════════════ */

const schema = readFileSync(new URL('../src/server/db/schema.ts', import.meta.url), 'utf8');

/** The audit_log table body, from its declaration to the closing of its columns. */
function auditLogBlock(): string {
  const start = schema.indexOf("export const auditLog = pgTable(");
  expect(start, 'audit_log table not found in the schema').toBeGreaterThan(-1);
  return schema.slice(start, start + 1400);
}

describe('audit_log.actor_id', () => {
  it('carries no foreign key to users', () => {
    const block = auditLogBlock();
    const actorLine = block.split('\n').find((line) => line.includes("uuid('actor_id')"));
    expect(actorLine, 'actor_id column not found').toBeTruthy();
    expect(actorLine).not.toContain('.references(');
  });

  it('still records who did it, so history reads after an account is gone', () => {
    const block = auditLogBlock();
    expect(block).toContain("actorEmail: varchar('actor_email'");
  });

  it('has a migration that drops the constraint on databases that already have it', () => {
    const migration = readFileSync(new URL('../drizzle/sql/0002_audit_actor_no_fk.sql', import.meta.url), 'utf8');
    expect(migration).toContain('DROP CONSTRAINT');
    expect(migration).toContain('audit_log');
    // Idempotent: every SQL file is applied on every setup, not once.
    expect(migration).toContain('IF constraint_name IS NOT NULL');
  });
});

describe('the append-only rule it protects', () => {
  it('is still in place', () => {
    const immutable = readFileSync(new URL('../drizzle/sql/0001_audit_immutable.sql', import.meta.url), 'utf8');
    expect(immutable.toLowerCase()).toContain('audit_log');
    expect(immutable.toLowerCase()).toMatch(/update|delete/);
  });
});
