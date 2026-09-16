import { afterEach, describe, expect, it } from 'vitest';
import { CAREERS_PATH, JOB_META, careersPath, jobPath, jobPaths } from '@/lib/careers';
import { employmentType, jobPostingNode } from '@/lib/seo/jsonld';

/* ═══════════════════════════════════════════════════════════════════════════
   Careers URLs and structured data
   ───────────────────────────────────────────────────────────────────────────
   Four things have to agree about where an advert lives — the public routes,
   the sitemap, the admin's view links and every `revalidateContent` call after
   a save — which is why they all read `lib/careers.ts`. These pin what it
   answers, in one language and in several.

   And `JobPosting` is the one node in the graph with a duty attached: a search
   engine that indexes an advert keeps sending people to it. A wrong
   `employmentType` is a rich result that lies about the job.
   ═══════════════════════════════════════════════════════════════════════════ */

const original = process.env.ENGINE_LOCALES;
afterEach(() => {
  if (original === undefined) delete process.env.ENGINE_LOCALES;
  else process.env.ENGINE_LOCALES = original;
});

describe('where an advert lives', () => {
  it('leaves the main language unprefixed and prefixes the rest', () => {
    process.env.ENGINE_LOCALES = 'en,hy,ru';
    expect(careersPath('en')).toBe('/careers');
    expect(jobPath('engineer', 'en')).toBe('/careers/engineer');
    expect(jobPath('inzhener', 'ru')).toBe('/ru/careers/inzhener');
    expect(careersPath('hy')).toBe('/hy/careers');
  });

  it('is unprefixed everywhere on a single-language site', () => {
    process.env.ENGINE_LOCALES = 'en';
    expect(careersPath()).toBe('/careers');
    expect(jobPath('engineer')).toBe('/careers/engineer');
  });

  it('follows a site whose main language is not English', () => {
    process.env.ENGINE_LOCALES = 'hy,en';
    expect(jobPath('injener', 'hy')).toBe('/careers/injener');
    expect(jobPath('engineer', 'en')).toBe('/en/careers/engineer');
  });

  /* Editing one advert changes two pages: its own, and the listing that shows
     every open role. Forgetting the second is how a filled role goes on being
     advertised until something else revalidates. */
  it('names both pages a change to one advert affects', () => {
    process.env.ENGINE_LOCALES = 'en,ru';
    expect(jobPaths('engineer', 'en')).toEqual(['/careers/engineer', '/careers']);
    expect(jobPaths('inzhener', 'ru')).toEqual(['/ru/careers/inzhener', '/ru/careers']);
  });

  it('keeps the six meta labels in the order the design shows them', () => {
    expect(JOB_META.map(([key]) => key)).toEqual([
      'location',
      'department',
      'contractType',
      'workingTime',
      'seniority',
      'workweek',
    ]);
    expect(CAREERS_PATH).toBe('/careers');
  });
});

describe('employmentType', () => {
  it('maps the contract types people actually type', () => {
    expect(employmentType('Full time')).toBe('FULL_TIME');
    expect(employmentType('full-time')).toBe('FULL_TIME');
    expect(employmentType('  PART TIME  ')).toBe('PART_TIME');
    expect(employmentType('Contract')).toBe('CONTRACTOR');
    expect(employmentType('Internship')).toBe('INTERN');
  });

  /* The field is free text, and a wrong enum value is worse than a missing
     optional one: "Hybrid — 3 days in office" is a working pattern, not an
     employment type. */
  it('gives nothing rather than a guess for anything else', () => {
    expect(employmentType('Hybrid — 3 days in office')).toBeNull();
    expect(employmentType('')).toBeNull();
    expect(employmentType(undefined)).toBeNull();
    expect(employmentType(null)).toBeNull();
  });
});

describe('the JobPosting node', () => {
  const node = (over: Record<string, unknown> = {}) =>
    jobPostingNode({
      path: '/careers/engineer',
      title: 'Frontend Engineer',
      description: 'Build the things people actually touch.',
      datePosted: '2026-08-01T09:00:00.000Z',
      validThrough: '2026-10-01T09:00:00.000Z',
      location: 'Yerevan',
      contractType: 'Full time',
      department: 'Engineering',
      organisationName: 'Wellar Group',
      ...over,
    }) as Record<string, unknown>;

  it('carries what a search engine needs to show the advert', () => {
    const job = node();
    expect(job['@type']).toBe('JobPosting');
    expect(job.title).toBe('Frontend Engineer');
    expect(job.datePosted).toBe('2026-08-01T09:00:00.000Z');
    expect(job.validThrough).toBe('2026-10-01T09:00:00.000Z');
    expect(job.employmentType).toBe('FULL_TIME');
    expect(job.occupationalCategory).toBe('Engineering');
  });

  /* Google reads `hiringOrganization` itself and does not always resolve a
     bare @id reference, so the name is written out as well. */
  it('names the hiring organisation rather than only referencing it', () => {
    const hiring = node().hiringOrganization as Record<string, unknown>;
    expect(hiring.name).toBe('Wellar Group');
    expect(hiring['@type']).toBe('Organization');
  });

  it('gives the location as a Place with an address', () => {
    const place = node().jobLocation as Record<string, unknown>;
    const address = place.address as Record<string, unknown>;
    expect(place['@type']).toBe('Place');
    expect(address.addressLocality).toBe('Yerevan');
  });

  it('leaves out every field the advert did not fill in', () => {
    const bare = node({
      datePosted: undefined,
      validThrough: undefined,
      location: '',
      contractType: 'Hybrid, 3 days on site',
      department: '',
    });
    for (const key of ['datePosted', 'validThrough', 'employmentType', 'occupationalCategory', 'jobLocation']) {
      expect(bare, key).not.toHaveProperty(key);
    }
    // What remains is still a valid posting.
    expect(bare.title).toBe('Frontend Engineer');
    expect(bare.hiringOrganization).toBeTruthy();
  });
});
