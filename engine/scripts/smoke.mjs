#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server.
 *
 * Checks the things a unit test cannot: that the public pages render, that the
 * SEO surfaces are correct, that the admin panel is actually closed to
 * anonymous traffic, that authentication behaves, and that the access rules
 * hold on the server rather than only in the UI.
 *
 * It assumes nothing about the site's content. The pages it checks are the
 * ones the site's own sitemaps list, so the same suite runs against a freshly
 * installed blank site and against a finished one. A check that needs content
 * the site does not have yet — a published post, say — is reported as SKIP,
 * never as a pass and never as a failure.
 *
 * The full login check needs a real account: set SMOKE_EMAIL and
 * SMOKE_PASSWORD (in the environment or .env). Each run makes one deliberately
 * wrong attempt against that account, so point it at a test account — repeated
 * runs count towards its lockout like any other failed sign-in.
 *
 * The contact-form checks submit real enquiries, which are stored and appear in
 * the admin under Contact enquiries.
 *
 * Usage: node scripts/smoke.mjs [baseUrl]
 */

import 'dotenv/config';

const BASE = (process.argv[2] ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

/** Mirrors the server's AUTH_REQUIRE_2FA, read from the same .env. */
const REQUIRE_2FA = process.env.AUTH_REQUIRE_2FA !== 'false';

const SMOKE_EMAIL = process.env.SMOKE_EMAIL?.trim();
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ${GREEN}PASS${RESET} ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ${RED}FAIL${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function skip(name, reason) {
  skipped += 1;
  console.log(`  ${YELLOW}SKIP${RESET} ${name} — ${reason}`);
}

function section(title) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

async function get(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
}

async function text(path) {
  const res = await get(path);
  return { res, body: res.ok ? await res.text() : '' };
}

/**
 * The paths a sitemap lists. Its `<loc>`s carry the configured site origin,
 * which is not necessarily the server under test, so only the path is kept.
 */
function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => {
      try {
        return new URL(m[1].trim()).pathname;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * A sitemap's entries with the two hints the blog sitemap uses to tell its
 * URLs apart. Since 2.13 the blog's addresses are a setting (Permalinks), so
 * the suite reads what kind of URL each one is rather than matching `/blog/`.
 */
function sitemapEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => {
      const loc = /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1];
      try {
        return {
          path: new URL(loc.trim()).pathname,
          changefreq: /<changefreq>([^<]+)</.exec(m[1])?.[1] ?? '',
          priority: /<priority>([^<]+)</.exec(m[1])?.[1] ?? '',
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** A path without its trailing slash, for comparing shapes. */
const bare = (path) => path.replace(/\/+$/, '') || '/';

/** The checks every public HTML page must pass. Returns the HTML. */
async function checkPage(path) {
  const { res, body: html } = await text(path);
  check(`GET ${path} -> 200`, res.status === 200, `got ${res.status}`);
  if (html) {
    const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
    check(`  ${path} has exactly one h1`, h1s === 1, `found ${h1s}`);
    check(`  ${path} has a meta description`, /<meta name="description"/.test(html));
    check(`  ${path} has a canonical link`, /rel="canonical"/.test(html));
    check(`  ${path} emits JSON-LD`, html.includes('application/ld+json'));
  }
  return html;
}

/** Minimal cookie jar so the auth flow can be exercised across requests. */
function jarFrom(response, jar = {}) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const cookie of raw) {
    const [pair] = cookie.split(';');
    const idx = pair.indexOf('=');
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === '') delete jar[name];
    else jar[name] = value;
  }
  return jar;
}

const cookieHeader = (jar) =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

const login = (email, password) =>
  get('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

async function main() {
  console.log(`\nSmoke test against ${BASE}\n${'-'.repeat(60)}`);

  /* Public pages — whatever the site's own sitemaps say it has */
  section('Public pages');

  const pagesMap = await text('/sitemaps/pages.xml');
  const servicesMap = await text('/sitemaps/services.xml');
  const listedPages = sitemapPaths(pagesMap.body);
  const listedServices = sitemapPaths(servicesMap.body);

  check('pages sitemap lists the home page', listedPages.includes('/'), `listed: ${listedPages.join(', ') || 'nothing'}`);

  const pagePaths = [...new Set(['/', ...listedPages, ...listedServices])];
  for (const path of pagePaths) await checkPage(path);

  /* The site's trailing-slash form, read off its own sitemap: every address
     a slashed site writes ends in "/", and the other spelling redirects. */
  const slashed = listedPages.some((p) => p !== '/' && p.endsWith('/'));
  const own = (path) => (slashed && path !== '/' && !path.endsWith('/') ? `${path}/` : path);

  /* The blog index and research come first in the blog sitemap, then the
     categories (weekly, 0.6) and the posts (monthly). */
  const blogMap = await text('/sitemaps/blog.xml');
  const blogEntries = sitemapEntries(blogMap.body);
  const [indexEntry, researchEntry] = blogEntries;
  const blogIndex = indexEntry?.path ?? own('/blog');

  // Routes that exist whether or not anybody has made a page for them.
  for (const path of [blogIndex, researchEntry?.path ?? own('/blog/research')]) await checkPage(path);

  const notFound = await get(own(`/smoke-missing-${Date.now()}`));
  check('unknown path -> 404', notFound.status === 404, `got ${notFound.status}`);

  /* Blog */
  section('Blog');

  const rest = blogEntries.slice(2);
  const postPath = rest.find((e) => e.changefreq === 'monthly')?.path;
  const categoryPath = rest.find((e) => e.changefreq === 'weekly' && e.priority === '0.6')?.path;

  if (postPath) {
    const html = await checkPage(postPath);
    check('  post emits Article structured data', html.includes('"@type":"Article"'));
  } else {
    skip('published post renders', 'no posts published yet');
  }

  if (categoryPath) {
    await checkPage(categoryPath);
  } else {
    skip('category page renders', 'no categories yet');
  }

  const search = await text(`${blogIndex}?q=smoke`);
  check('blog search view renders', search.res.status === 200, `got ${search.res.status}`);
  const canonical = /rel="canonical" href="([^"]*)"/.exec(search.body)?.[1] ?? '';
  check(`  search view canonicalises to ${blogIndex}`, canonical.endsWith(blogIndex), `got ${canonical}`);

  /* Careers */
  section('Careers');

  const careersMap = await text('/sitemaps/careers.xml');
  const careerPaths = sitemapPaths(careersMap.body);

  // The listing exists whether or not anybody has written a page for it.
  await checkPage(own('/careers'));

  const jobPath = careerPaths.find((p) => /^\/careers\/[^/]+$/.test(bare(p)));
  if (jobPath) {
    const html = await checkPage(jobPath);
    check('  open role emits JobPosting structured data', html.includes('"@type":"JobPosting"'));
    check('  open role is indexable', !/name="robots" content="[^"]*noindex/.test(html));
    check(
      '  open role offers the application form',
      html.includes('name="cv"') && html.includes('type="file"'),
    );
  } else {
    skip('published role renders', 'no open roles published yet');
  }

  /* A filled role keeps its page and loses its listing: no JobPosting, and
     noindex, so a search result never sends anybody to a vacancy that has
     gone. The sitemap is the check — a closed role must not be in it. */
  check(
    '  careers sitemap lists only the listing and open roles',
    careerPaths.every((p) => bare(p) === '/careers' || /^\/careers\/[^/]+$/.test(bare(p))),
    `listed: ${careerPaths.join(', ') || 'nothing'}`,
  );

  /* Projects (2.14) — whatever the projects sitemap lists: a project emits
     CreativeWork, and an archive is an ordinary page. */
  section('Projects');
  const projectsMap = await text('/sitemaps/projects.xml');
  const projectEntries = sitemapEntries(projectsMap.body);
  const projectPath = projectEntries.find((e) => e.changefreq === 'monthly')?.path;
  const projectArchive = projectEntries.find((e) => e.changefreq === 'weekly')?.path;
  if (projectPath) {
    const html = await checkPage(projectPath);
    check('  project emits CreativeWork structured data', html.includes('"@type":"CreativeWork"'));
  } else {
    skip('published project renders', 'no projects published yet');
  }
  if (projectArchive) await checkPage(projectArchive);
  else skip('project archive renders', 'no project categories or tags in use yet');
  const moreProjects = await get('/api/projects?limit=2');
  check('public project list answers with JSON', moreProjects.status === 200, `got ${moreProjects.status}`);
  const badProjects = await get('/api/projects?category=%3Cscript%3E');
  check('public project list refuses a malformed filter', badProjects.status === 400, `got ${badProjects.status}`);

  /* The endpoint is reachable and refuses a body it cannot read. 429 counts
     as a pass: the limiter is five an hour, and a few smoke runs will trip it
     — which is the feature working, not a regression. */
  const applyAnon = await get('/api/applications', { method: 'POST' });
  check(
    '  application endpoint refuses a request with no role',
    applyAnon.status === 400 || applyAnon.status === 429,
    `got ${applyAnon.status}`,
  );

  /* SEO surfaces */
  section('SEO surfaces');

  const robots = await text('/robots.txt');
  check('robots.txt served', robots.res.status === 200);
  check('  keeps crawlers out of /admin', robots.body.includes('Disallow: /admin') || robots.body.includes('Disallow: /'));

  const sitemap = await text('/sitemap.xml');
  check('sitemap index served', sitemap.res.status === 200);
  check(
    '  references every segment',
    ['/sitemaps/pages.xml', '/sitemaps/services.xml', '/sitemaps/blog.xml', '/sitemaps/careers.xml', '/sitemaps/projects.xml'].every((s) =>
      sitemap.body.includes(s),
    ),
  );
  for (const [name, map] of [
    ['pages', pagesMap],
    ['services', servicesMap],
    ['blog', blogMap],
    ['careers', careersMap],
  ]) {
    check(`  ${name} sitemap is a urlset`, map.res.status === 200 && map.body.includes('<urlset'), `got ${map.res.status}`);
  }

  const llms = await text('/llms.txt');
  check('llms.txt served', llms.res.status === 200);
  check('  starts with the site name as its title', /^# \S/.test(llms.body));

  const manifestRes = await get('/manifest.webmanifest');
  const manifest = await manifestRes.json().catch(() => ({}));
  check('web manifest served with a name', manifestRes.status === 200 && Boolean(manifest.name), `got ${manifestRes.status}`);

  const health = await get('/api/health');
  const healthBody = await health.json().catch(() => ({}));
  check('health endpoint reports the database', health.status === 200 && healthBody.database === true);

  /* Security headers */
  section('Security headers');

  const home = await get('/');
  const csp = home.headers.get('content-security-policy') ?? '';
  check('Content-Security-Policy set', csp.length > 0);
  check('  frame-ancestors none', csp.includes("frame-ancestors 'none'"));
  check('  object-src none', csp.includes("object-src 'none'"));
  check('X-Content-Type-Options nosniff', home.headers.get('x-content-type-options') === 'nosniff');
  check('Referrer-Policy set', Boolean(home.headers.get('referrer-policy')));
  check('X-Frame-Options DENY', home.headers.get('x-frame-options') === 'DENY');
  check('no x-powered-by leak', !home.headers.get('x-powered-by'));

  const adminHeaders = await get('/admin/login');
  check('admin marked noindex', (adminHeaders.headers.get('x-robots-tag') ?? '').includes('noindex'));

  const install = await get('/install');
  check(
    'installer closed on an installed site',
    install.status === 307 && (install.headers.get('location') ?? '').includes('/admin'),
    `got ${install.status}`,
  );

  /* Access control */
  section('Access control');

  const adminAnon = await get('/admin');
  check(
    'anonymous /admin redirects to login',
    adminAnon.status === 307 && (adminAnon.headers.get('location') ?? '').includes('/admin/login'),
    `got ${adminAnon.status}`,
  );

  for (const path of [
    '/api/admin/pages',
    '/api/admin/posts',
    '/api/admin/categories',
    '/api/admin/users',
    '/api/admin/audit',
    '/api/admin/media',
    '/api/admin/settings',
    '/api/admin/enquiries',
    '/api/admin/profile',
    '/api/admin/theme',
    '/api/admin/navigation',
    '/api/admin/revisions',
    '/api/admin/redirects',
    '/api/admin/newsletter',
    '/api/admin/popups',
    '/api/admin/submissions',
    '/api/admin/templates',
    '/api/admin/email',
    '/api/admin/security',
    '/api/admin/updates',
    '/api/admin/backups',
    '/api/admin/transfer',
    '/api/admin/languages',
    '/api/admin/translations',
    '/api/admin/site-translations',
    '/api/admin/jobs',
    '/api/admin/applications',
    '/api/admin/cookies',
    '/api/admin/code',
    '/api/admin/permalinks',
    '/api/admin/projects',
    '/api/admin/projects/terms',
    '/api/admin/projects/settings',
    '/api/admin/saved-blocks',
  ]) {
    const res = await get(path);
    check(`anonymous GET ${path} -> 401`, res.status === 401, `got ${res.status}`);
  }

  // Preview mints a link to unpublished content and is POST-only, so it is
  // checked with the verb it actually answers.
  const anonPreview = await get('/api/admin/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entityType: 'page', entityId: '11111111-1111-1111-1111-111111111111' }),
  });
  check('anonymous POST /api/admin/preview -> 401', anonPreview.status === 401, `got ${anonPreview.status}`);

  // Purging every rendered page is POST-only too.
  const anonPurge = await get('/api/admin/cache', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  check('anonymous POST /api/admin/cache -> 401', anonPurge.status === 401, `got ${anonPurge.status}`);

  const anonPost = await get('/api/admin/pages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Should not exist' }),
  });
  check('unauthenticated POST rejected', anonPost.status === 401, `got ${anonPost.status}`);

  /* Authentication */
  section('Authentication');

  // An address on the reserved .invalid TLD can never belong to a real account.
  const unknownUser = await login(`smoke-${Date.now()}@example.invalid`, 'WhateverPass1!');
  check('unknown account -> 401', unknownUser.status === 401, `got ${unknownUser.status}`);

  if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
    skip('wrong password -> 401, same body as an unknown account', 'set SMOKE_EMAIL and SMOKE_PASSWORD');
    skip('correct password login behaviour', 'set SMOKE_EMAIL and SMOKE_PASSWORD');
  } else {
    const badLogin = await login(SMOKE_EMAIL, `${SMOKE_PASSWORD}-wrong`);
    check('wrong password -> 401', badLogin.status === 401, `got ${badLogin.status}`);
    check(
      '  identical response body for wrong password and unknown account (no user enumeration)',
      (await badLogin.clone().text()) === (await unknownUser.clone().text()),
    );

    const loginRes = await login(SMOKE_EMAIL, SMOKE_PASSWORD);
    const loginBody = await loginRes.json().catch(() => ({}));
    const jar = jarFrom(loginRes);

    // The assertions differ by mode, but both modes are checked to the same
    // depth: four checks either way, so the total does not move.
    if (REQUIRE_2FA) {
      // With AUTH_REQUIRE_2FA on, a correct password alone must not be a session.
      const twoFactorEnforced = loginBody.status === '2fa_setup_required' || loginBody.status === '2fa_required';
      check('correct password does not grant a session without 2FA', twoFactorEnforced, `status was ${loginBody.status}`);
      check('  no access cookie issued at the password step', !jar.he_at);

      const pendingSession = await get('/api/auth/session', { headers: { cookie: cookieHeader(jar) } });
      check('  pending 2FA cannot read the session', pendingSession.status === 401, `got ${pendingSession.status}`);

      const pendingWrite = await get('/api/admin/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader(jar) },
        body: JSON.stringify({ title: 'Should not exist' }),
      });
      check('  pending 2FA cannot write', pendingWrite.status === 401, `got ${pendingWrite.status}`);
    } else {
      // With the second factor off, the password completes the login — and the
      // rest of the session machinery must still hold.
      check('correct password grants a session (2FA disabled)', loginBody.status === 'ok', `status was ${loginBody.status}`);
      check('  access cookie issued at the password step', Boolean(jar.he_at));

      const session = await get('/api/auth/session', { headers: { cookie: cookieHeader(jar) } });
      check('  session is readable', session.status === 200, `got ${session.status}`);

      // A session is not a licence to skip CSRF: a mutating call without the
      // double-submit header must still be refused.
      const noCsrfWrite = await get('/api/admin/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader(jar) },
        body: JSON.stringify({ title: 'Should not exist' }),
      });
      check('  write without a CSRF token refused', noCsrfWrite.status === 403, `got ${noCsrfWrite.status}`);
    }
  }

  /* Contact form */
  section('Contact form');

  // The public endpoint is rate limited per IP, so a repeat run on the same
  // box will legitimately see 429s. Both outcomes are correct behaviour; what
  // must never happen is a 500 or a silent accept of invalid input.
  const enquiryBody = {
    name: 'Smoke Test',
    email: 'smoke@example.com',
    company: 'Smoke test',
    message: 'This is an automated smoke test submission.',
  };

  const submitEnquiry = (body) =>
    get('/api/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const enquiry = await submitEnquiry(enquiryBody);
  check('valid enquiry accepted (or rate limited)', enquiry.status === 200 || enquiry.status === 429, `got ${enquiry.status}`);

  const invalid = await submitEnquiry({ name: '', email: 'not-an-email', message: '' });
  check('invalid enquiry rejected', invalid.status === 400 || invalid.status === 429, `got ${invalid.status}`);

  const honeypot = await submitEnquiry({ ...enquiryBody, website: 'http://spam.example' });
  check(
    'honeypot submission handled without an error',
    honeypot.status === 200 || honeypot.status === 429,
    `got ${honeypot.status}`,
  );

  // Prove the limiter actually engages rather than assuming it.
  let sawRateLimit = enquiry.status === 429 || invalid.status === 429 || honeypot.status === 429;
  for (let i = 0; i < 8 && !sawRateLimit; i += 1) {
    const res = await submitEnquiry(enquiryBody);
    if (res.status === 429) sawRateLimit = true;
  }
  check('enquiry endpoint rate limits a flood', sawRateLimit);

  /* Result */
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    console.log('');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nSmoke test could not run:', error.message);
  process.exit(1);
});
