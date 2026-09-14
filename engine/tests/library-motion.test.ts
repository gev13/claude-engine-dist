import { describe, expect, it } from 'vitest';
import { blockSchemas, parseBlock } from '../src/lib/blocks';
import { blockStyleSchema } from '../src/lib/blockStyle';
import { csvCell, toCsv } from '../src/lib/csv';

describe('phase 4 variants keep stored pages valid', () => {
  it('parses an old cta, contact form, rich text and statement as before', () => {
    expect(blockSchemas.cta.parse({ title: 'T' }).variant).toBe('band');
    expect(blockSchemas.contactForm.parse({}).layout).toBe('stacked');
    // Rich text and statement were merged into Text and Heading; stored ones still parse (block-migrations.test.ts).
    expect(parseBlock({ id: 'a', type: 'richText', props: { html: '<p>x</p>' } })?.props).toMatchObject({ variant: 'default' });
    expect(parseBlock({ id: 'b', type: 'statement', props: { statement: 'S' } })?.props).toMatchObject({ animation: 'none' });
  });

  it('offers reveal as a closed choice on every block style', () => {
    expect(blockStyleSchema.safeParse({ reveal: 'rise' }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ reveal: 'spin' }).success).toBe(false);
  });
});

describe('scroll effects', () => {
  it('needs two to eight steps in a scroll story', () => {
    expect(blockSchemas.scrollStory.safeParse({ items: [{ title: 'One' }] }).success).toBe(false);
    expect(blockSchemas.scrollStory.parse({ items: [{ title: 'One' }, { title: 'Two' }] }).numbered).toBe(true);
  });

  it('keeps pinned media to the media grammar and a closed length', () => {
    expect(blockSchemas.pinnedMedia.parse({}).length).toBe('medium');
    expect(blockSchemas.pinnedMedia.safeParse({ videoUrl: 'javascript:x' }).success).toBe(false);
    expect(blockSchemas.pinnedMedia.safeParse({ length: 'forever' }).success).toBe(false);
  });
});

describe('newsletter', () => {
  it('defaults to the form layout with a Subscribe button', () => {
    expect(blockSchemas.newsletter.parse({ title: 'T' })).toMatchObject({ layout: 'form', buttonLabel: 'Subscribe' });
  });

  it('rejects an unsafe band link', () => {
    expect(blockSchemas.newsletter.safeParse({ title: 'T', layout: 'band', href: 'javascript:alert(1)' }).success).toBe(false);
  });
});

describe('CSV export', () => {
  it('quotes every cell and doubles quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('""');
  });

  it('neutralises values a spreadsheet would run as formulas', () => {
    for (const value of ['=HYPERLINK("x")', '+1', '-1', '@SUM(A1)', '\tx']) {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    }
  });

  it('writes dates as ISO strings and ends lines with CRLF', () => {
    const csv = toCsv(['email', 'when'], [['a@example.com', new Date('2026-01-02T03:04:05Z')]]);
    expect(csv).toBe('"email","when"\r\n"a@example.com","2026-01-02T03:04:05.000Z"\r\n');
  });
});
