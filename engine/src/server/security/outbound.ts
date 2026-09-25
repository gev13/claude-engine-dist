import 'server-only';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

/* ═══════════════════════════════════════════════════════════════════════════
   Requests to addresses somebody typed (2.16)
   ───────────────────────────────────────────────────────────────────────────
   A webhook URL is fetched by the server, from inside whatever network the
   server sits in — so `https://169.254.169.254/` (a cloud's metadata service)
   or `https://db.internal/` would be a request the public internet could not
   make. Two rules stop it:

   - **Where it resolves is checked, not what it is called.** A public name
     can point at a private address, so the check runs in the socket's own
     DNS lookup: the address that is vetted is the address connected to, and
     a name that resolves differently a second time (DNS rebinding) cannot
     slip between a check and a connect.
   - **Redirects are not followed.** A 3xx is reported as a failure; a
     receiver that moved says so, and the administrator updates the address.
   ═══════════════════════════════════════════════════════════════════════════ */

function v4Private(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** Whether an address is on the public internet: not loopback, private, link-local, shared or multicast. */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !v4Private(ip);
  if (kind !== 6) return false;
  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return !v4Private(mapped[1]!);
  return !(
    lower === '::' ||
    lower === '::1' ||
    /^f[cd]/.test(lower) ||
    /^fe[89ab]/.test(lower) ||
    /^ff/.test(lower) ||
    lower.startsWith('64:ff9b:') ||
    lower.startsWith('2001:db8')
  );
}

export class OutboundRefused extends Error {}

/** A lookup that only ever hands the socket a public address. */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0);
    const list = addresses as unknown as { address: string; family: number }[];
    // Every address must be public: a name that answers with one of each is refused.
    if (list.length === 0 || list.some((entry) => !isPublicAddress(entry.address))) {
      return callback(new OutboundRefused(`${hostname} resolves to an address that is not on the public internet`), '', 0);
    }
    const first = list[0]!;
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, first.address, first.family);
  });
};

export type OutboundResult = { ok: true; status: number } | { ok: false; status?: number; error: string };

/**
 * POST a body to an https address that must be public. Never throws; a
 * refusal, a timeout and a non-2xx answer all come back as `ok: false` with
 * something an administrator can act on.
 */
export function postPublic(url: string, body: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<OutboundResult> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, error: 'That is not an address.' });
    }
    if (target.protocol !== 'https:') return resolve({ ok: false, error: 'Only https:// addresses are allowed.' });
    if (isIP(target.hostname.replace(/^\[|\]$/g, '')) && !isPublicAddress(target.hostname.replace(/^\[|\]$/g, ''))) {
      return resolve({ ok: false, error: 'That address is not on the public internet.' });
    }

    const req = httpsRequest(
      target,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body).toString(), 'user-agent': 'engine-webhook/1', ...headers },
        lookup: publicLookup,
        timeout: timeoutMs,
      },
      (res) => {
        // The body is not wanted; read and discard so the socket is released.
        res.resume();
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) resolve({ ok: true, status });
        else if (status >= 300 && status < 400) resolve({ ok: false, status, error: `Redirected (${status}) — redirects are not followed; update the address.` });
        else resolve({ ok: false, status, error: `The receiver answered ${status}.` });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`No answer within ${Math.round(timeoutMs / 1000)} seconds.`)));
    req.on('error', (error) => {
      resolve({ ok: false, error: error instanceof OutboundRefused ? error.message : (error.message || 'The request failed.').slice(0, 280) });
    });
    req.end(body);
  });
}

export type FetchedResult =
  | { ok: true; status: number; body: Buffer; contentType: string; headers: Record<string, string | string[] | undefined>; url: string }
  | { ok: false; status?: number; error: string };

/**
 * GET a public address — the WordPress importer's reads (2.20). The same
 * vetted lookup as `postPublic`, so no name can point the server at itself or
 * the private network; http is allowed as well as https, because the thing
 * being read is public content, not a secret being sent. A redirect is
 * followed at most three times, each hop checked again from scratch, and the
 * body is cut off at `maxBytes` rather than read into memory unbounded.
 */
export async function getPublic(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number; accept?: string } = {},
  hops = 0,
): Promise<FetchedResult> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { ok: false, error: 'That is not an address.' };
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return { ok: false, error: 'Only http:// and https:// addresses can be read.' };
  if (target.username || target.password) return { ok: false, error: 'An address with a password in it is not read.' };
  const host = target.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) return { ok: false, error: 'That address is not on the public internet.' };

  const result = await new Promise<FetchedResult | { redirect: string }>((resolve) => {
    const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(
      target,
      {
        method: 'GET',
        headers: { accept: options.accept ?? '*/*', 'user-agent': 'engine-importer/1' },
        lookup: publicLookup,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: new URL(res.headers.location, target).toString() });
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return resolve({ ok: false, status, error: `Larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.` });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            resolve({ ok: false, status, error: `Larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.` });
          } else chunks.push(chunk);
        });
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (status >= 200 && status < 300) {
            resolve({ ok: true, status, body, contentType: String(res.headers['content-type'] ?? ''), headers: res.headers, url: target.toString() });
          } else resolve({ ok: false, status, error: `The site answered ${status}.` });
        });
        res.on('error', (error) => resolve({ ok: false, status, error: error.message.slice(0, 280) }));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`No answer within ${Math.round(timeoutMs / 1000)} seconds.`)));
    req.on('error', (error) => resolve({ ok: false, error: error instanceof OutboundRefused ? error.message : (error.message || 'The request failed.').slice(0, 280) }));
    req.end();
  });

  if ('redirect' in result) {
    if (hops >= 3) return { ok: false, error: 'Redirected too many times.' };
    return getPublic(result.redirect, options, hops + 1);
  }
  return result;
}
