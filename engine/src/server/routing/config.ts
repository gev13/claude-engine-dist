import { eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db';
import { redirects, settings } from '@/server/db/schema';
import { DEFAULT_PERMALINKS, PERMALINKS_SETTING_KEY, resolvePermalinks, setSlashMode, type Permalinks } from '@/lib/permalinks';
import { MATCH_TYPES, type MatchType, type RedirectRule } from '@/lib/redirectRules';
import { buildCsp, mergeSources, type CspSources } from '@/lib/csp';
import { INTEGRATIONS_SETTING_KEY, PRESETS, integrationSources, resolveIntegrations } from '@/lib/integrations';
import { CAPTCHA_CSP, CAPTCHA_SETTING_KEY, captchaSettingsSchema } from '@/lib/captcha';
import { ANALYTICS_PATTERN, CODE_SETTING_KEY } from '@/lib/customCode';
import { MEDIA_SETTING_KEY, resolveMediaSettings } from '@/lib/mediaSettings';
import { setImageMode } from '@/lib/responsive';

/* ═══════════════════════════════════════════════════════════════════════════
   The routing configuration, cached per process
   ───────────────────────────────────────────────────────────────────────────
   Read by the middleware on every request and by the routes that resolve a
   path, so it is held in memory for fifteen seconds rather than read from
   Postgres each time. A save in this process clears it at once
   (`invalidateRouting`); another process — a second pm2 instance — picks the
   change up when its copy expires.

   Deliberately **not** `server-only`: the middleware imports it, and runs on
   Node since 2.13 precisely so it can (it used to run on the Edge runtime,
   where there is no database at any price). It never throws. A database that
   cannot be read means today's defaults — the blog at `/blog`, no trailing
   slash, no redirect rules — which is a working site, not an error page.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RoutingConfig = {
  permalinks: Permalinks;
  /** Rules that also match a query — applied by the middleware, before any route. */
  queryRules: (RedirectRule & { id: string })[];
  /** Everything else — applied only where a route would otherwise 404. */
  pathRules: (RedirectRule & { id: string })[];
  /**
   * The public site's Content-Security-Policy (2.16), built from what is
   * switched on: integrations, custom snippets' origins, the CAPTCHA
   * provider. The middleware sends it on every page.
   */
  csp: string;
  /** Whether engine images carry a `srcset` (2.17, Settings → Media). */
  responsiveImages: boolean;
};

const isProd = process.env.NODE_ENV === 'production';

/** The policy for a set of settings rows — pure apart from reading them, and tested. */
export function publicCsp(rows: Map<string, unknown>): string {
  const lists: CspSources[] = [integrationSources(resolveIntegrations(rows.get(INTEGRATIONS_SETTING_KEY)))];
  // A GA4 id from before 2.16 (Custom code) still loads, so its hosts are still allowed.
  const legacy = (rows.get(CODE_SETTING_KEY) as { analyticsId?: unknown } | undefined)?.analyticsId;
  if (!rows.has(INTEGRATIONS_SETTING_KEY) && typeof legacy === 'string' && ANALYTICS_PATTERN.test(legacy.trim().toUpperCase())) {
    lists.push(PRESETS.ga4.csp);
  }
  const captcha = captchaSettingsSchema.safeParse(rows.get(CAPTCHA_SETTING_KEY) ?? {});
  if (captcha.success && captcha.data.provider !== 'none') lists.push(CAPTCHA_CSP[captcha.data.provider]);
  return buildCsp({ isProd, extra: mergeSources(...lists) });
}

const TTL_MS = 15_000;
/** A failed read is retried sooner than a good one expires. */
const RETRY_MS = 3_000;

type Cache = { value: RoutingConfig; expires: number; pending?: Promise<RoutingConfig> };
const holder = globalThis as unknown as { __heRouting?: Cache };

const FALLBACK: RoutingConfig = { permalinks: DEFAULT_PERMALINKS, queryRules: [], pathRules: [], csp: buildCsp({ isProd }), responsiveImages: false };

async function load(): Promise<{ value: RoutingConfig; ok: boolean }> {
  try {
    const [settingRows, rules] = await Promise.all([
      db
        .select({ key: settings.key, value: settings.value })
        .from(settings)
        .where(inArray(settings.key, [PERMALINKS_SETTING_KEY, INTEGRATIONS_SETTING_KEY, CAPTCHA_SETTING_KEY, CODE_SETTING_KEY, MEDIA_SETTING_KEY])),
      db
        .select({
          id: redirects.id,
          fromPath: redirects.fromPath,
          matchType: redirects.matchType,
          matchQuery: redirects.matchQuery,
          keepRest: redirects.keepRest,
          toPath: redirects.toPath,
          status: redirects.status,
          isActive: redirects.isActive,
        })
        .from(redirects)
        .where(eq(redirects.isActive, true)),
    ]);

    const shaped = rules.map((rule) => ({
      ...rule,
      matchType: ((MATCH_TYPES as readonly string[]).includes(rule.matchType) ? rule.matchType : 'exact') as MatchType,
      status: (rule.status === 302 ? 302 : 301) as 301 | 302,
    }));

    const byKey = new Map(settingRows.map((row) => [row.key, row.value]));
    return {
      ok: true,
      value: {
        csp: publicCsp(byKey),
        responsiveImages: resolveMediaSettings(byKey.get(MEDIA_SETTING_KEY)).responsive,
        permalinks: resolvePermalinks(byKey.get(PERMALINKS_SETTING_KEY)),
        queryRules: shaped.filter((rule) => rule.matchQuery !== ''),
        pathRules: shaped.filter((rule) => rule.matchQuery === ''),
      },
    };
  } catch {
    return { ok: false, value: holder.__heRouting?.value ?? FALLBACK };
  }
}

export async function routingConfig(): Promise<RoutingConfig> {
  const cache = holder.__heRouting;
  const now = Date.now();
  if (cache && cache.expires > now) return cache.value;
  if (cache?.pending) return cache.pending;

  const pending = load().then(({ value, ok }) => {
    holder.__heRouting = { value, expires: Date.now() + (ok ? TTL_MS : RETRY_MS) };
    setSlashMode(value.permalinks.trailingSlash);
    setImageMode(value.responsiveImages);
    return value;
  });
  holder.__heRouting = { value: cache?.value ?? FALLBACK, expires: 0, pending };
  return pending;
}

/** The permalinks alone — what most callers want. */
export async function getPermalinks(): Promise<Permalinks> {
  return (await routingConfig()).permalinks;
}

/** Drop this process's copy, so the next request reads what was just saved. */
export function invalidateRouting(): void {
  holder.__heRouting = undefined;
}
