import 'server-only';
import { SITE_URL, isProd } from '@/lib/env';

/**
 * Tell search engines a URL changed.
 *
 * Google retired its sitemap ping endpoint in 2023 and Bing followed, so the
 * modern mechanism is IndexNow — one POST, honoured by Bing, Yandex, Seznam
 * and Naver, and shared between them. Google is not an IndexNow participant;
 * it discovers changes through the sitemap referenced in robots.txt, which is
 * regenerated on every publish.
 *
 * Best effort by design: this must never delay or fail a publish.
 */

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

function indexNowKey(): string | null {
  return process.env.INDEXNOW_KEY?.trim() || null;
}

export async function pingSearchEngines(paths: string[]): Promise<void> {
  if (!isProd) return;

  const key = indexNowKey();
  if (!key) return;

  const host = SITE_URL.replace(/^https?:\/\//, '');
  const urlList = [...new Set(paths)].map((p) => `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`).slice(0, 10_000);
  if (urlList.length === 0) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (error) {
    console.error('[ping] IndexNow submission failed', error);
  }
}
