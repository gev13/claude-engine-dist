import { z } from 'zod';
import { CSP_ORIGIN, type CspSources, mergeSources } from './csp';

/* ═══════════════════════════════════════════════════════════════════════════
   Integrations — tracking and marketing tags (T10, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   An administrator types an id; the engine writes the vendor's own loader
   around it. So what runs in a visitor's browser is code in this repository,
   and the only thing a settings field reaches is an id held to its vendor's
   shape — the rule `/analytics.js` has followed since GA4 was the only one.

   Each preset declares what it needs from the Content-Security-Policy and
   which consent category it belongs to. The middleware builds the policy
   from the ones switched on, and the consent manager (lib/cookies.ts) decides
   when each may load. Nothing is enabled on a new site.

   **Custom snippets** are the one exception, and are fenced: administrators
   only, off until "Allow custom scripts" is ticked, each one consent-gated,
   each origin it needs typed out and shown on the Security screen.
   ═══════════════════════════════════════════════════════════════════════════ */

export const INTEGRATIONS_SETTING_KEY = 'integrations';

export const CONSENT_CATEGORIES = ['necessary', 'analytics', 'marketing', 'preferences'] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export const PRESET_KEYS = ['gtm', 'ga4', 'googleAds', 'meta', 'linkedin', 'yandex', 'clarity', 'hotjar', 'tiktok'] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

type Preset = {
  label: string;
  /** What the id looks like — it is interpolated into a URL and a script. */
  id: RegExp;
  idHint: string;
  category: ConsentCategory;
  /** Google's tags can load before consent under Consent Mode, with storage denied. */
  consentMode: boolean;
  csp: CspSources;
};

const GOOGLE_ANALYTICS_HOSTS = [
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
  'https://stats.g.doubleclick.net',
];

export const PRESETS: Record<PresetKey, Preset> = {
  gtm: {
    label: 'Google Tag Manager',
    id: /^GTM-[A-Z0-9]{4,12}$/,
    idHint: 'GTM-XXXXXXX',
    category: 'analytics',
    consentMode: true,
    csp: {
      script: ['https://www.googletagmanager.com'],
      img: ['https://www.googletagmanager.com', ...GOOGLE_ANALYTICS_HOSTS],
      connect: GOOGLE_ANALYTICS_HOSTS,
      frame: ['https://www.googletagmanager.com'],
    },
  },
  ga4: {
    label: 'Google Analytics 4',
    id: /^G-[A-Z0-9]{4,24}$/,
    idHint: 'G-XXXXXXXXXX',
    category: 'analytics',
    consentMode: true,
    csp: { script: ['https://www.googletagmanager.com'], img: GOOGLE_ANALYTICS_HOSTS, connect: GOOGLE_ANALYTICS_HOSTS },
  },
  googleAds: {
    label: 'Google Ads',
    id: /^AW-[0-9]{6,15}$/,
    idHint: 'AW-1234567890',
    category: 'marketing',
    consentMode: true,
    csp: {
      script: ['https://www.googletagmanager.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net'],
      img: ['https://www.google.com', 'https://googleads.g.doubleclick.net', 'https://www.googleadservices.com'],
      connect: ['https://www.google.com', 'https://googleads.g.doubleclick.net', 'https://www.googleadservices.com', ...GOOGLE_ANALYTICS_HOSTS],
      frame: ['https://td.doubleclick.net', 'https://bid.g.doubleclick.net'],
    },
  },
  meta: {
    label: 'Meta Pixel',
    id: /^[0-9]{8,20}$/,
    idHint: '489030143776932',
    category: 'marketing',
    consentMode: false,
    csp: { script: ['https://connect.facebook.net'], img: ['https://www.facebook.com'], connect: ['https://www.facebook.com', 'https://connect.facebook.net'] },
  },
  linkedin: {
    label: 'LinkedIn Insight',
    id: /^[0-9]{4,12}$/,
    idHint: 'partner id, e.g. 1234567',
    category: 'marketing',
    consentMode: false,
    csp: { script: ['https://snap.licdn.com'], img: ['https://px.ads.linkedin.com'], connect: ['https://px.ads.linkedin.com'] },
  },
  yandex: {
    label: 'Yandex Metrika',
    id: /^[0-9]{5,12}$/,
    idHint: 'counter number',
    category: 'analytics',
    consentMode: false,
    csp: {
      script: ['https://mc.yandex.ru', 'https://yastatic.net'],
      img: ['https://mc.yandex.ru', 'https://mc.yandex.com'],
      connect: ['https://mc.yandex.ru', 'https://mc.yandex.com'],
      frame: ['https://mc.yandex.ru', 'https://mc.yandex.com'],
    },
  },
  clarity: {
    label: 'Microsoft Clarity',
    id: /^[a-z0-9]{6,16}$/,
    idHint: 'project id',
    category: 'analytics',
    consentMode: false,
    csp: { script: ['https://www.clarity.ms', 'https://*.clarity.ms'], img: ['https://*.clarity.ms', 'https://c.bing.com'], connect: ['https://*.clarity.ms'] },
  },
  hotjar: {
    label: 'Hotjar',
    id: /^[0-9]{5,10}$/,
    idHint: 'site id',
    category: 'analytics',
    consentMode: false,
    csp: {
      script: ['https://static.hotjar.com', 'https://script.hotjar.com'],
      img: ['https://*.hotjar.com'],
      connect: ['https://*.hotjar.com', 'https://*.hotjar.io', 'wss://*.hotjar.com'],
      font: ['https://script.hotjar.com'],
      style: ['https://static.hotjar.com'],
      frame: ['https://vars.hotjar.com'],
    },
  },
  tiktok: {
    label: 'TikTok Pixel',
    id: /^[A-Z0-9]{12,24}$/,
    idHint: 'pixel id',
    category: 'marketing',
    consentMode: false,
    csp: { script: ['https://analytics.tiktok.com'], img: ['https://analytics.tiktok.com'], connect: ['https://analytics.tiktok.com'] },
  },
};

/* ── The settings row ────────────────────────────────────────────────────── */

const origin = z
  .string()
  .trim()
  .refine((value) => CSP_ORIGIN.test(value), 'An origin such as https://cdn.example.com — no path');

const itemSchema = (key: PresetKey) =>
  z.object({
    enabled: z.boolean().default(false),
    id: z
      .string()
      .trim()
      .refine((value) => value === '' || PRESETS[key].id.test(value), `Looks like ${PRESETS[key].idHint}`)
      .default(''),
    category: z.enum(CONSENT_CATEGORIES).default(PRESETS[key].category),
    /** Hosts a container or pixel loads beyond the vendor's own — mostly for Tag Manager. */
    extraOrigins: z.array(origin).max(20).default([]),
  });

export const integrationsSchema = z.object({
  /**
   * Google Consent Mode v2: `consent default` (denied) before any Google tag,
   * `consent update` on a choice. With it on, Google's tags load before
   * consent and send only cookieless pings until somebody agrees.
   */
  consentMode: z.boolean().default(false),
  gtm: itemSchema('gtm').extend({
    /** The `<noscript>` iframe after `<body>`. It cannot ask anybody's consent, so it is off unless chosen. */
    noscript: z.boolean().default(false),
  }).prefault({}),
  ga4: itemSchema('ga4').prefault({}),
  googleAds: itemSchema('googleAds').extend({
    /** Conversion labels a form can fire, by name: `Contact form` → `AbCdEf123`. */
    conversions: z
      .array(z.object({ name: z.string().trim().min(1).max(60), label: z.string().trim().regex(/^[A-Za-z0-9_-]{4,40}$/, 'A conversion label') }))
      .max(20)
      .default([]),
  }).prefault({}),
  meta: itemSchema('meta').prefault({}),
  linkedin: itemSchema('linkedin').prefault({}),
  yandex: itemSchema('yandex').extend({
    webvisor: z.boolean().default(false),
    clickmap: z.boolean().default(true),
    trackLinks: z.boolean().default(true),
    accurateTrackBounce: z.boolean().default(true),
  }).prefault({}),
  clarity: itemSchema('clarity').prefault({}),
  hotjar: itemSchema('hotjar').prefault({}),
  tiktok: itemSchema('tiktok').prefault({}),

  /** Off until an administrator ticks it — the one door to arbitrary script. */
  allowCustomScripts: z.boolean().default(false),
  snippets: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
        name: z.string().trim().min(1).max(80),
        enabled: z.boolean().default(true),
        location: z.enum(['head', 'bodyStart', 'bodyEnd']).default('head'),
        /** HTML: script tags, a noscript pixel. Runs in every visitor's browser — administrators only. */
        code: z.string().max(20_000),
        /** `/*` or empty for every page; `/blog/*` and `/contact` otherwise. */
        pages: z.array(z.string().trim().regex(/^\/[A-Za-z0-9._~\-/%*]*$/, 'A path such as /contact or /blog/*')).max(20).default([]),
        category: z.enum(CONSENT_CATEGORIES).default('marketing'),
        origins: z.array(origin).max(20).default([]),
      }),
    )
    .max(10)
    .default([]),
});

export type Integrations = z.output<typeof integrationsSchema>;

export const defaultIntegrations = (): Integrations => integrationsSchema.parse({});

export function resolveIntegrations(value: unknown): Integrations {
  const parsed = integrationsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : defaultIntegrations();
}

/** The presets that are on and have a valid id — the only ones that load or reach the CSP. */
export function activePresets(settings: Integrations): PresetKey[] {
  return PRESET_KEYS.filter((key) => settings[key].enabled && PRESETS[key].id.test(settings[key].id));
}

/** The custom snippets that may run: the switch is on, and the snippet is. */
export function activeSnippets(settings: Integrations) {
  return settings.allowCustomScripts ? settings.snippets.filter((snippet) => snippet.enabled && snippet.code.trim()) : [];
}

/** What the public policy has to allow for everything switched on. */
export function integrationSources(settings: Integrations): CspSources {
  const lists: CspSources[] = [];
  for (const key of activePresets(settings)) {
    lists.push(PRESETS[key].csp);
    const extra = settings[key].extraOrigins;
    if (extra.length) lists.push({ script: extra, connect: extra, img: extra, frame: extra, style: extra, font: extra });
  }
  for (const snippet of activeSnippets(settings)) {
    const o = snippet.origins;
    lists.push({ script: o, connect: o, img: o, frame: o, style: o, font: o, media: o });
  }
  return mergeSources(...lists);
}

/** Every host one set of sources names, once each, in order. */
export function sourceHosts(sources: CspSources): string[] {
  return [...new Set(Object.values(sources).flatMap((list) => [...(list ?? [])]))];
}

/**
 * What the public site hands to a third party, by name — for the Security
 * screen, which says so plainly rather than leaving it to the policy header.
 */
export function thirdParties(settings: Integrations): { name: string; hosts: string[] }[] {
  return [
    ...activePresets(settings).map((key) => ({ name: PRESETS[key].label, hosts: sourceHosts(mergeSources(PRESETS[key].csp, { script: settings[key].extraOrigins })) })),
    ...activeSnippets(settings).map((snippet) => ({ name: `Snippet: ${snippet.name}`, hosts: [...snippet.origins] })),
  ];
}

/** Whether a page path matches a snippet's pages (empty or `/*` is everywhere). */
export function pathMatches(patterns: readonly string[], path: string): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => {
    if (pattern === '/*' || pattern === '*') return true;
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2) || '/';
      return path === base || path.startsWith(`${base}/`);
    }
    return path.replace(/\/+$/, '') === pattern.replace(/\/+$/, '');
  });
}
