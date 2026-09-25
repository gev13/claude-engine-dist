import 'server-only';
import { randomUUID } from 'node:crypto';
import { desc, eq, lt } from 'drizzle-orm';
import { SITE_URL } from '@/lib/env';
import {
  DELIVERY_HEADER,
  EVENT_HEADER,
  RETRY_DELAYS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WEBHOOKS_SETTING_KEY,
  hooksFor,
  resolveWebhooks,
  type Webhook,
  type WebhookEvent,
  type WebhooksSettings,
} from '@/lib/webhooks';
import { db } from '@/server/db';
import { enquiries, formSubmissions, settings, webhookDeliveries } from '@/server/db/schema';
import { decryptSecret } from '@/server/security/secrets';
import { postPublic } from '@/server/security/outbound';
import { signPayload } from './sign';

/* ═══════════════════════════════════════════════════════════════════════════
   Handing a submission to a webhook (T13, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Started and not awaited, like the notification emails: the visitor's
   answer is stored and acknowledged whatever the receiver does. Each hook
   gets a row in `webhook_deliveries` before the first attempt and the row is
   updated after each one — three in all, at once, after ten seconds and
   after a minute. A process that restarts part-way leaves the row `pending`,
   which the screen shows, and the Resend button is the answer.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Deliveries older than this are pruned when new ones are written. */
const KEEP_DAYS = 30;

export async function getWebhooks(): Promise<WebhooksSettings> {
  try {
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, WEBHOOKS_SETTING_KEY)).limit(1);
    return resolveWebhooks(row?.value);
  } catch {
    return resolveWebhooks(undefined);
  }
}

type Payload = { event: WebhookEvent | 'webhook.test'; data: Record<string, unknown> };

const wait = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** One delivery, every attempt, recorded as it goes. Never throws. */
async function deliver(hook: Webhook, payload: Payload, targetId: string | null, existingId?: string): Promise<void> {
  try {
    let id = existingId;
    if (id) {
      await db.update(webhookDeliveries).set({ status: 'pending', attempts: 0, responseCode: null, error: null, updatedAt: new Date() }).where(eq(webhookDeliveries.id, id));
    } else {
      const [row] = await db
        .insert(webhookDeliveries)
        .values({ webhookId: hook.id, webhookName: hook.name, event: payload.event, targetId })
        .returning({ id: webhookDeliveries.id });
      id = row!.id;
      void db
        .delete(webhookDeliveries)
        .where(lt(webhookDeliveries.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)))
        .catch(() => undefined);
    }

    const body = JSON.stringify({ id, event: payload.event, createdAt: new Date().toISOString(), site: SITE_URL, data: payload.data });
    const secret = decryptSecret(hook.secret);

    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      if (RETRY_DELAYS[attempt]) await wait(RETRY_DELAYS[attempt]!);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const headers: Record<string, string> = { [EVENT_HEADER]: payload.event, [DELIVERY_HEADER]: id, [TIMESTAMP_HEADER]: timestamp };
      if (secret) headers[SIGNATURE_HEADER] = signPayload(secret, timestamp, body);

      const result = await postPublic(hook.url, body, headers);
      const done = result.ok || attempt === RETRY_DELAYS.length - 1;
      await db
        .update(webhookDeliveries)
        .set({
          attempts: attempt + 1,
          status: result.ok ? 'ok' : done ? 'failed' : 'pending',
          responseCode: result.status ?? null,
          error: result.ok ? null : result.error.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, id));
      if (result.ok) return;
    }
  } catch (error) {
    console.error('[webhooks] delivery failed', { hook: hook.name, error });
  }
}

/* ── What each event carries ──────────────────────────────────────────────── */

const adminLink = (path: string) => `${SITE_URL}${path}`;

export async function submissionPayload(submissionId: string): Promise<{ formName: string; data: Record<string, unknown> } | null> {
  const [row] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, submissionId)).limit(1);
  if (!row) return null;
  return {
    formName: row.formName,
    data: {
      submissionId: row.id,
      formId: row.formId,
      formName: row.formName,
      page: row.source,
      receivedAt: row.createdAt.toISOString(),
      answers: row.answers.map((answer) => {
        const file = (answer as { file?: { originalName: string } }).file;
        return {
          id: answer.id,
          label: answer.label,
          value: answer.value,
          // A link for somebody signed in to the admin, never the file itself.
          ...(file ? { file: { name: file.originalName, url: adminLink(`/api/admin/submissions/${row.id}/file/${answer.id}`) } } : {}),
        };
      }),
      hidden: row.meta,
    },
  };
}

export async function enquiryPayload(enquiryId: string): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
  if (!row) return null;
  return {
    enquiryId: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    businessType: row.businessType,
    services: row.services,
    timing: row.timing,
    message: row.message,
    receivedAt: row.createdAt.toISOString(),
  };
}

/* ── Entry points ─────────────────────────────────────────────────────────── */

/** A form block was sent: every enabled hook for this form, in the background. */
export function dispatchSubmission(submissionId: string, formName: string): void {
  void (async () => {
    const hooks = hooksFor(await getWebhooks(), 'form.submitted', formName);
    if (hooks.length === 0) return;
    const built = await submissionPayload(submissionId);
    if (!built) return;
    await Promise.all(hooks.map((hook) => deliver(hook, { event: 'form.submitted', data: built.data }, submissionId)));
  })().catch((error) => console.error('[webhooks] dispatch failed', error));
}

/** The contact form was sent. */
export function dispatchEnquiry(enquiryId: string): void {
  void (async () => {
    const hooks = hooksFor(await getWebhooks(), 'enquiry.received');
    if (hooks.length === 0) return;
    const data = await enquiryPayload(enquiryId);
    if (!data) return;
    await Promise.all(hooks.map((hook) => deliver(hook, { event: 'enquiry.received', data }, enquiryId)));
  })().catch((error) => console.error('[webhooks] dispatch failed', error));
}

/**
 * A test delivery, awaited so the screen can say what happened: one attempt,
 * no retries, and the answer comes back.
 */
export async function testWebhook(hook: Webhook): Promise<{ ok: boolean; status?: number; error?: string }> {
  const id = randomUUID();
  const body = JSON.stringify({ id, event: 'webhook.test', createdAt: new Date().toISOString(), site: SITE_URL, data: { message: 'A test from the Webhooks screen.' } });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = decryptSecret(hook.secret);
  const headers: Record<string, string> = { [EVENT_HEADER]: 'webhook.test', [DELIVERY_HEADER]: id, [TIMESTAMP_HEADER]: timestamp };
  if (secret) headers[SIGNATURE_HEADER] = signPayload(secret, timestamp, body);
  const result = await postPublic(hook.url, body, headers);
  await db
    .insert(webhookDeliveries)
    .values({
      webhookId: hook.id,
      webhookName: hook.name,
      event: 'webhook.test',
      status: result.ok ? 'ok' : 'failed',
      attempts: 1,
      responseCode: result.status ?? null,
      error: result.ok ? null : result.error.slice(0, 300),
    })
    .catch(() => undefined);
  return result.ok ? { ok: true, status: result.status } : { ok: false, status: result.status, error: result.error };
}

/** Send a logged delivery again, rebuilt from what it was about. */
export async function resendDelivery(deliveryId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId)).limit(1);
  if (!row) return { ok: false, error: 'That delivery is not in the log any more.' };
  const hook = (await getWebhooks()).hooks.find((candidate) => candidate.id === row.webhookId);
  if (!hook) return { ok: false, error: 'That webhook has been removed.' };
  if (!row.targetId) return { ok: false, error: 'A test cannot be resent — use Send a test.' };

  let data: Record<string, unknown> | null = null;
  if (row.event === 'form.submitted') data = (await submissionPayload(row.targetId))?.data ?? null;
  else if (row.event === 'enquiry.received') data = await enquiryPayload(row.targetId);
  if (!data) return { ok: false, error: 'What it was about has been deleted, so there is nothing to send.' };

  void deliver(hook, { event: row.event as WebhookEvent, data }, row.targetId, row.id);
  return { ok: true };
}

export async function recentDeliveries(limit = 50) {
  return db.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(limit);
}
