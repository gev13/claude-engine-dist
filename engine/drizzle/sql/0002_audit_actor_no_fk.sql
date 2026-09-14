-- The audit log must not reference users.
--
-- audit_log.actor_id was declared ON DELETE SET NULL, which means deleting an
-- account makes Postgres update the log — and 0001 made the log append-only,
-- so the trigger refuses the UPDATE and the delete fails with it. The effect
-- was that any account which had ever done anything could not be deleted, and
-- a restore could not replace the users table.
--
-- An append-only log should not be rewritten when an account goes. The id it
-- recorded stays, and actor_email beside it keeps the entry readable.
--
-- Idempotent: the constraint name is whatever Postgres generated, so it is
-- looked up rather than assumed, and doing nothing is a valid outcome.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_name = 'audit_log'
     AND kcu.column_name = 'actor_id'
     AND ccu.table_name = 'users'
   LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE audit_log DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;
