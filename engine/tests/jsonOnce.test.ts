import { describe, expect, it } from 'vitest';
import { pgTable, jsonb } from 'drizzle-orm/pg-core';
import { decodeJsonOnce } from '@/server/db/jsonOnce';

/* 3.19 — a stored string that is also valid JSON ("2026") must come back a
   string. postgres.js decoded jsonb and drizzle decoded it again. */

const table = pgTable('t', { value: jsonb('value') });
const column = table.value;

describe('JSON read from the database', () => {
  const client = decodeJsonOnce({ options: { parsers: {} as Record<string, (text: string) => unknown> } });
  const read = (wire: string) => column.mapFromDriverValue(client.options.parsers['3802']!(wire));

  it('keeps strings that look like numbers, booleans or null as strings', () => {
    for (const text of ['2026', '75008', 'true', 'null', '1e3']) expect(read(JSON.stringify(text))).toBe(text);
  });

  it('still decodes everything else once', () => {
    expect(read('2026')).toBe(2026);
    expect(read('true')).toBe(true);
    expect(read('{"a":[1,"2"]}')).toEqual({ a: [1, '2'] });
    expect(read('"Northfold"')).toBe('Northfold');
  });

  it('covers json and jsonb', () => {
    expect(Object.keys(client.options.parsers).sort()).toEqual(['114', '3802']);
  });
});
