import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyRule,
  collapseChains,
  describeFrom,
  describeTo,
  parseFrom,
  parseTo,
  pickRule,
  readRedirectCsv,
  regexProblem,
  type RedirectRule,
} from '../src/lib/redirectRules';
import { planWrites } from '../src/server/content/redirectPlan';

const rule = (overrides: Partial<RedirectRule>): RedirectRule => ({
  fromPath: '/old',
  matchType: 'exact',
  matchQuery: '',
  keepRest: false,
  toPath: '/new',
  status: 301,
  isActive: true,
  ...overrides,
});

describe('reading what somebody typed', () => {
  it('knows an exact path, a prefix, a query rule and a pattern apart', () => {
    expect(parseFrom('/old/')).toEqual({ fromPath: '/old', matchType: 'exact', matchQuery: '' });
    expect(parseFrom('/portfolio-tag/*')).toEqual({ fromPath: '/portfolio-tag', matchType: 'prefix', matchQuery: '' });
    expect(parseFrom('/?s=*')).toEqual({ fromPath: '/', matchType: 'exact', matchQuery: 's=*' });
    expect(parseFrom('^/(\\d{4})/(.*)$')).toEqual({ fromPath: '^/(\\d{4})/(.*)$', matchType: 'regex', matchQuery: '' });
  });

  it('writes a rule back in the same notation, so an export imports as it stands', () => {
    for (const typed of ['/old', '/portfolio-tag/*', '/?s=*', '/shop/*?ref=*']) {
      const shape = parseFrom(typed);
      expect(parseFrom(describeFrom(shape))).toEqual(shape);
    }
    const kept = parseTo('/projects/*', 'prefix');
    expect(kept).toEqual({ toPath: '/projects', keepRest: true });
    expect(describeTo({ ...kept, matchType: 'prefix' })).toBe('/projects/*');
    expect(parseTo('/projects/*', 'exact')).toEqual({ toPath: '/projects/*', keepRest: false });
  });
});

describe('matching', () => {
  it('sends a whole prefix somewhere, optionally keeping the rest of the path', () => {
    const tag = rule({ fromPath: '/portfolio-tag', matchType: 'prefix', toPath: '/projects' });
    expect(applyRule(tag, '/portfolio-tag/unknown')).toBe('/projects');
    expect(applyRule(tag, '/portfolio-tag')).toBe('/projects');
    expect(applyRule(tag, '/portfolio-tagged')).toBeNull();
    expect(applyRule({ ...tag, keepRest: true }, '/portfolio-tag/a/b')).toBe('/projects/a/b');
  });

  it('captures query values in order, encoded', () => {
    const search = rule({ fromPath: '/', matchQuery: 's=*', toPath: '/blog?q=$1' });
    expect(applyRule(search, '/', new URLSearchParams('s=slot design'))).toBe('/blog?q=slot%20design');
    expect(applyRule(search, '/', new URLSearchParams('x=1'))).toBeNull();
    expect(applyRule(search, '/about', new URLSearchParams('s=a'))).toBeNull();
  });

  it('runs a checked pattern with its groups as $1, $2…', () => {
    const dated = rule({ fromPath: '^/(\\d{4})/(\\d{2})/([a-z0-9-]+)$', matchType: 'regex', toPath: '/blog/$3' });
    expect(applyRule(dated, '/2024/05/hello-world')).toBe('/blog/hello-world');
    expect(applyRule(dated, '/about')).toBeNull();
  });

  it('prefers an exact path, then the longest prefix, then a pattern', () => {
    const rules = [
      rule({ fromPath: '^/shop/.*$', matchType: 'regex', toPath: '/r' }),
      rule({ fromPath: '/shop', matchType: 'prefix', toPath: '/p1' }),
      rule({ fromPath: '/shop/sale', matchType: 'prefix', toPath: '/p2' }),
      rule({ fromPath: '/shop/sale/x', toPath: '/e' }),
    ];
    expect(pickRule(rules, '/shop/sale/x')?.to).toBe('/e');
    expect(pickRule(rules, '/shop/sale/y')?.to).toBe('/p2');
    expect(pickRule(rules, '/shop/other')?.to).toBe('/p1');
  });

  it('skips a rule that would send a path to itself, and an inactive one', () => {
    expect(pickRule([rule({ fromPath: '/a', matchType: 'prefix', toPath: '/a' })], '/a')).toBeNull();
    expect(pickRule([rule({ isActive: false })], '/old')).toBeNull();
  });
});

describe('patterns that cannot hang a server', () => {
  it('accepts ordinary patterns, including non-capturing and named groups', () => {
    for (const ok of ['^/(\\d{4})/(.*)$', '^/(?:en|de)/(.*)$', '^/(?<slug>[a-z-]+)$', '^/[a-z]+(-[0-9]+)?$']) {
      expect(regexProblem(ok), ok).toBeNull();
    }
  });

  it('refuses nested repetition, back-references, lookbehind and nonsense', () => {
    for (const bad of ['^(a+)+$', '^/(.*)*$', '^/((ab)*)+$', '^/(a)\\1$', '^(?<=x)y$', '^/(unclosed$', '']) {
      expect(regexProblem(bad), bad).not.toBeNull();
    }
  });
});

describe('chains and loops', () => {
  it('collapses A → B → C into A → C', () => {
    const { rules, loops } = collapseChains([rule({ fromPath: '/a', toPath: '/b' }), rule({ fromPath: '/b', toPath: '/c' })]);
    expect(loops).toEqual([]);
    expect(rules[0]!.toPath).toBe('/c');
    expect(rules[1]!.toPath).toBe('/c');
  });

  it('names a loop rather than storing it', () => {
    const { loops } = collapseChains([rule({ fromPath: '/a', toPath: '/b' }), rule({ fromPath: '/b', toPath: '/a' })]);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops[0]).toContain('/a');
  });
});

describe('CSV', () => {
  it('reads the engine’s own columns, quoted cells and all', () => {
    const { rows, problems } = readRedirectCsv('from,to,status,note\r\n/old,/new,301,"a, note"\n"/tag/*","/projects/*",302,\n');
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { line: 2, from: '/old', to: '/new', status: 301, note: 'a, note', matchType: 'exact' },
      { line: 3, from: '/tag/*', to: '/projects/*', status: 302, note: '', matchType: 'prefix' },
    ]);
  });

  it('reads a Yoast export, where paths have no leading slash and a pattern says so', () => {
    const { rows } = readRedirectCsv('"Origin","Target","Type","Format"\n"old-post","new-post","301","plain"\n"^/(\\d+)/$","/","301","regex"\n');
    expect(rows[0]).toMatchObject({ from: '/old-post', to: '/new-post', matchType: 'exact' });
    expect(rows[1]).toMatchObject({ matchType: 'regex' });
  });

  it('refuses a status nobody should use', () => {
    expect(readRedirectCsv('/a,/b,404').problems).toHaveLength(1);
  });

  it('plans 150 rows in one go, and says what it will do with each', () => {
    const csv = ['from,to', ...Array.from({ length: 150 }, (_, i) => `/old-${i},/new-${i}`)].join('\n');
    const plan = planWrites(readRedirectCsv(csv).rows, [], { allowRegex: false, onDuplicate: 'update' });
    expect(plan.counts).toEqual({ create: 150, update: 0, skip: 0, error: 0 });
  });

  it('refuses a loop in the file, a duplicate, an engine path, and a pattern from a non-administrator', () => {
    const csv = 'from,to\n/a,/b\n/b,/a\n/c,/d\n/c,/e\n/admin/x,/y\n^/x$,/z\n';
    const plan = planWrites(readRedirectCsv(csv).rows, [], { allowRegex: false, onDuplicate: 'update' });
    const byLine = Object.fromEntries(plan.rows.map((row) => [row.line, row]));
    expect(byLine[2]!.action).toBe('error');
    expect(byLine[3]!.action).toBe('error');
    expect(byLine[4]!.action).toBe('create');
    expect(byLine[5]!.action).toBe('skip');
    expect(byLine[6]!.action).toBe('error');
    expect(byLine[7]!.action).toBe('error');
  });

  it('settles a chain through a stored rule into one hop', () => {
    const stored = [{ id: 'x', fromPath: '/b', toPath: '/c', matchType: 'exact', matchQuery: '', keepRest: false, status: 301, isActive: true }];
    const plan = planWrites(readRedirectCsv('/a,/b').rows, stored, { allowRegex: false, onDuplicate: 'update' });
    const created = plan.rows[0]!;
    expect(created.action).toBe('create');
    expect('rule' in created && created.rule.toPath).toBe('/c');
  });
});

/* Query rules have to run before any route, so the middleware applies them —
   which is why it runs on Node and reads the routing config. Pinned, because
   moving it back to the Edge runtime would silently drop both. */
describe('the middleware', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'middleware.ts'), 'utf8');
  const config = readFileSync(path.join(__dirname, '..', 'next.config.ts'), 'utf8');

  it('runs on Node and reads the routing config', () => {
    expect(source).toMatch(/runtime:\s*'nodejs'/);
    expect(source).toContain('routingConfig()');
  });

  it('owns the trailing slash, so Next does not strip it at build time', () => {
    expect(config).toMatch(/skipTrailingSlashRedirect:\s*true/);
  });
});
