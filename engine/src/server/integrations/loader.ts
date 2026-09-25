import 'server-only';
import { activePresets, activeSnippets, PRESETS, type Integrations } from '@/lib/integrations';

/* ═══════════════════════════════════════════════════════════════════════════
   /integrations.js — the one script that loads every tag (T10/T11, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Generated from the settings, served from the site's own origin. It does
   four things, in this order:

     1. with Consent Mode on, `gtag('consent', 'default', …)` — before any
        Google tag exists, which is the only place it counts;
     2. loads each vendor whose consent category has been granted (or, for a
        Google tag under Consent Mode, before consent with storage denied);
     3. listens for the consent manager's `he:consent` event: loads what was
        newly granted, sends `consent update`, and clears the known cookies of
        anything revoked;
     4. offers `heTrack(name, options)` — a form's conversion, sent to every
        vendor that is loaded.

   Every id in here was checked against its vendor's shape when it was saved
   and is checked again below, then written with JSON.stringify — the only
   way a setting reaches this file.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ConsentGate = {
  /** False: no consent manager, so everything loads as it always did. */
  gate: boolean;
  /** The version a stored answer must carry to count. */
  version: number;
  cookie: string;
  /** Ask only where consent is required — others count as having agreed. */
  regionRequired: boolean;
  regionCookie: string;
};

/** Cookies each vendor sets, cleared when their category is revoked. Prefixes. */
const VENDOR_COOKIES: Record<string, string[]> = {
  analytics: ['_ga', '_gid', '_gat', '_ym', '_clck', '_clsk', '_hj', 'yandexuid'],
  marketing: ['_gcl', '_fbp', '_fbc', 'li_', 'lidc', 'bcookie', 'bscookie', 'UserMatchHistory', 'AnalyticsSyncHistory', '_ttp', '_tt_'],
};

export function loaderSource(settings: Integrations, consent: ConsentGate): string {
  const items = activePresets(settings)
    .filter((key) => PRESETS[key].id.test(settings[key].id))
    .map((key) => {
      const item = settings[key];
      return {
        key,
        id: item.id,
        category: item.category,
        consentMode: settings.consentMode && PRESETS[key].consentMode,
        ...(key === 'yandex'
          ? {
              options: {
                clickmap: settings.yandex.clickmap,
                trackLinks: settings.yandex.trackLinks,
                accurateTrackBounce: settings.yandex.accurateTrackBounce,
                webvisor: settings.yandex.webvisor,
              },
            }
          : {}),
        ...(key === 'googleAds' ? { conversions: Object.fromEntries(settings.googleAds.conversions.map((c) => [c.name, c.label])) } : {}),
      };
    });
  const snippets = activeSnippets(settings).map(({ id, location, code, pages, category }) => ({ id, location, code, pages, category }));
  const config = {
    gate: consent.gate,
    version: consent.version,
    cookie: consent.cookie,
    regionRequired: consent.regionRequired,
    regionCookie: consent.regionCookie,
    consentMode: settings.consentMode && items.some((item) => PRESETS[item.key].consentMode),
    items,
    snippets,
    vendorCookies: VENDOR_COOKIES,
  };

  return `/* Written by the engine from Settings → Integrations. */
(function (w, d) {
  if (w.__heTags) return;
  var C = ${JSON.stringify(config)};
  w.__heTags = C;
  var loaded = {};
  var ran = {};

  /* ── What has been agreed to ─────────────────────────────────────────── */
  function granted() {
    var all = { necessary: true, analytics: true, marketing: true, preferences: true };
    if (!C.gate) return all;
    if (C.regionRequired && (d.cookie.match(new RegExp('(?:^|; )' + C.regionCookie + '=([^;]*)')) || [])[1] === 'other') return all;
    var out = { necessary: true, analytics: false, marketing: false, preferences: false };
    var raw = (d.cookie.match(new RegExp('(?:^|; )' + C.cookie + '=([^;]*)')) || [])[1];
    if (!raw) return out;
    var parts = {};
    decodeURIComponent(raw).split('|').forEach(function (p) { var kv = p.split(':'); parts[kv[0]] = kv[1]; });
    if (Number(parts.v) !== C.version) return out;
    out.analytics = parts.a === '1';
    out.marketing = parts.m === '1';
    out.preferences = parts.p === '1';
    return out;
  }

  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  if (!w.gtag) w.gtag = gtag;

  function consentState(g) {
    return {
      ad_storage: g.marketing ? 'granted' : 'denied',
      ad_user_data: g.marketing ? 'granted' : 'denied',
      ad_personalization: g.marketing ? 'granted' : 'denied',
      analytics_storage: g.analytics ? 'granted' : 'denied',
      functionality_storage: g.preferences ? 'granted' : 'denied',
      personalization_storage: g.preferences ? 'granted' : 'denied',
      security_storage: 'granted'
    };
  }
  if (C.consentMode) {
    var first = consentState(granted());
    first.wait_for_update = 500;
    w.gtag('consent', 'default', first);
  }

  function script(src, attrs) {
    var s = d.createElement('script');
    s.async = true;
    s.src = src;
    if (attrs) for (var k in attrs) s.setAttribute(k, attrs[k]);
    (d.head || d.documentElement).appendChild(s);
  }

  /* ── The vendors ─────────────────────────────────────────────────────── */
  var gtagLoaded = false;
  function googleTag(id) {
    if (!gtagLoaded) {
      gtagLoaded = true;
      script('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
      w.gtag('js', new Date());
    }
    w.gtag('config', id);
  }

  var LOAD = {
    gtm: function (it) {
      w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      script('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(it.id));
    },
    ga4: function (it) { googleTag(it.id); },
    googleAds: function (it) { googleTag(it.id); },
    meta: function (it) {
      if (!w.fbq) {
        var n = (w.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
        if (!w._fbq) w._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        script('https://connect.facebook.net/en_US/fbevents.js');
      }
      w.fbq('init', it.id);
      w.fbq('track', 'PageView');
    },
    linkedin: function (it) {
      w._linkedin_partner_id = it.id;
      w._linkedin_data_partner_ids = w._linkedin_data_partner_ids || [];
      w._linkedin_data_partner_ids.push(it.id);
      if (!w.lintrk) { w.lintrk = function (a, b) { w.lintrk.q.push([a, b]); }; w.lintrk.q = []; }
      script('https://snap.licdn.com/li.lms-analytics/insight.min.js');
    },
    yandex: function (it) {
      w.ym = w.ym || function () { (w.ym.a = w.ym.a || []).push(arguments); };
      w.ym.l = 1 * new Date();
      script('https://mc.yandex.ru/metrika/tag.js');
      w.ym(Number(it.id), 'init', it.options || {});
    },
    clarity: function (it) {
      w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };
      script('https://www.clarity.ms/tag/' + encodeURIComponent(it.id));
    },
    hotjar: function (it) {
      w.hj = w.hj || function () { (w.hj.q = w.hj.q || []).push(arguments); };
      w._hjSettings = { hjid: Number(it.id), hjsv: 6 };
      script('https://static.hotjar.com/c/hotjar-' + encodeURIComponent(it.id) + '.js?sv=6');
    },
    tiktok: function (it) {
      var q = (w.ttq = w.ttq || []);
      var methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      methods.forEach(function (m) { q[m] = q[m] || function () { q.push([m].concat([].slice.call(arguments))); }; });
      w.TiktokAnalyticsObject = 'ttq';
      script('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=' + encodeURIComponent(it.id) + '&lib=ttq');
      q.page();
    }
  };

  function allowed(category, consentMode, g) {
    return category === 'necessary' || g[category] || consentMode;
  }

  function matches(pages, path) {
    if (!pages.length) return true;
    return pages.some(function (p) {
      if (p === '/*' || p === '*') return true;
      if (p.slice(-2) === '/*') { var b = p.slice(0, -2) || '/'; return path === b || path.indexOf(b + '/') === 0; }
      return path.replace(/\\/+$/, '') === p.replace(/\\/+$/, '');
    });
  }

  function snippet(sn) {
    var frag = d.createRange().createContextualFragment(sn.code);
    if (sn.location === 'head') d.head.appendChild(frag);
    else if (sn.location === 'bodyStart') d.body.insertBefore(frag, d.body.firstChild);
    else d.body.appendChild(frag);
  }

  function run() {
    var g = granted();
    C.items.forEach(function (it) {
      if (loaded[it.key] || !allowed(it.category, it.consentMode, g)) return;
      loaded[it.key] = it;
      try { LOAD[it.key](it); } catch (e) { /* one vendor failing must not stop the rest */ }
    });
    var path = w.location.pathname;
    C.snippets.forEach(function (sn) {
      if (ran[sn.id] || !allowed(sn.category, false, g) || !matches(sn.pages, path)) return;
      ran[sn.id] = true;
      try { snippet(sn); } catch (e) { /* nor one snippet */ }
    });
  }

  function clearCookies(category) {
    var prefixes = C.vendorCookies[category] || [];
    var host = w.location.hostname.split('.');
    d.cookie.split('; ').forEach(function (c) {
      var name = c.split('=')[0];
      if (!prefixes.some(function (p) { return name.indexOf(p) === 0; })) return;
      for (var i = 0; i < host.length - 1; i++) {
        var domain = host.slice(i).join('.');
        d.cookie = name + '=; Max-Age=0; path=/; domain=' + domain;
        d.cookie = name + '=; Max-Age=0; path=/; domain=.' + domain;
      }
      d.cookie = name + '=; Max-Age=0; path=/';
    });
  }

  var last = granted();
  run();

  w.addEventListener('he:consent', function () {
    var now = granted();
    if (C.consentMode) w.gtag('consent', 'update', consentState(now));
    ['analytics', 'marketing', 'preferences'].forEach(function (k) { if (last[k] && !now[k]) clearCookies(k); });
    last = now;
    run();
  });

  /* A client-side navigation: snippets meant for the new page, and the
     vendors that do not follow history changes by themselves. */
  w.heTagsNavigate = function () {
    run();
    if (loaded.yandex && w.ym) w.ym(Number(loaded.yandex.id), 'hit', w.location.href);
    if (loaded.meta && w.fbq) w.fbq('track', 'PageView');
    if (loaded.tiktok && w.ttq && w.ttq.page) w.ttq.page();
  };

  /* ── Conversions ─────────────────────────────────────────────────────── */
  var LABEL = /^[A-Za-z0-9_-]{1,60}$/;
  w.heTrack = function (name, o) {
    o = o || {};
    if (!LABEL.test(name)) return;
    var params = o.params || {};
    w.dataLayer.push(Object.assign({ event: name }, params));
    if (loaded.ga4 || loaded.googleAds) w.gtag('event', name, params);
    if (loaded.googleAds && o.adsConversion) {
      var label = loaded.googleAds.conversions && loaded.googleAds.conversions[o.adsConversion];
      if (label) w.gtag('event', 'conversion', { send_to: loaded.googleAds.id + '/' + label });
    }
    if (loaded.meta && w.fbq) w.fbq('track', name === 'generate_lead' ? 'Lead' : 'CustomEvent', name === 'generate_lead' ? params : { event: name });
    if (loaded.yandex && w.ym && o.yandexGoal && LABEL.test(o.yandexGoal)) w.ym(Number(loaded.yandex.id), 'reachGoal', o.yandexGoal);
    if (loaded.linkedin && w.lintrk && /^[0-9]{3,12}$/.test(String(o.linkedinConversion || ''))) w.lintrk('track', { conversion_id: Number(o.linkedinConversion) });
    if (loaded.tiktok && w.ttq && w.ttq.track) w.ttq.track(name === 'generate_lead' ? 'SubmitForm' : name);
  };
})(window, document);
`;
}
