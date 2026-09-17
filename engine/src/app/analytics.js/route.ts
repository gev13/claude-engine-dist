import { getSiteCode } from '@/server/content/code';
import { ANALYTICS_PATTERN } from '@/lib/customCode';

export const revalidate = 3600;

/* ═══════════════════════════════════════════════════════════════════════════
   The analytics tag, written here rather than pasted in
   ───────────────────────────────────────────────────────────────────────────
   An editor gives the engine a measurement id; this writes the tag around it.
   That is the whole difference between this and a snippet field: what runs in
   a visitor's browser is code in this repository, reviewable here, and the
   only thing an editor controls is an id matched against a pattern.

   Served from the site's own origin rather than written inline, so it needs
   nothing from `script-src` beyond `'self'` — the CSP happens to allow inline
   script today, and this does not want to depend on that staying true.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET() {
  const code = await getSiteCode();

  /* Checked again here even though the schema checked it: this value is
     interpolated into a URL and a JavaScript string literal. */
  if (!ANALYTICS_PATTERN.test(code.analyticsId)) {
    return new Response('/* analytics is switched off */\n', {
      headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  }

  const id = code.analyticsId;
  const body = `(function () {
  var id = ${JSON.stringify(id)};
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id);
})();
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      /* Short, because switching analytics off in the admin should take
         effect in minutes rather than when a browser feels like it. */
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
}
