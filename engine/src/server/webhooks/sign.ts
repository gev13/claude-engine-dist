import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * `sha256=<hex>` of `<timestamp>.<body>`, keyed with the webhook's secret.
 * The timestamp is inside the signature so a captured request cannot be
 * replayed later with a fresh one — the receiver refuses an old timestamp.
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}
