import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@/server/db';
import { auditLog } from '@/server/db/schema';

export type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  requestId?: string | null;
};

/** Values that must never reach the log, whatever a caller passes. */
const REDACT = /pass|secret|token|totp|hash|authorization|cookie|recovery/i;

function scrub(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = REDACT.test(k) ? '[redacted]' : v;
  }
  return out;
}

/**
 * Append to the immutable audit log. Never throws: a logging failure must not
 * roll back the action it was recording, and the database trigger already
 * guarantees nothing written here can later be altered.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ? String(input.targetId).slice(0, 120) : null,
      summary: input.summary ?? '',
      metadata: scrub(input.metadata),
      ip: input.ip ?? null,
      requestId: input.requestId ?? randomUUID(),
    });
  } catch (error) {
    console.error('[audit] failed to write entry', { action: input.action, error });
  }
}
