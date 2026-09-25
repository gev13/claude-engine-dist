import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { transferJsonSchema } from '@/server/engine/transferSchema';
import { CONTENT_TABLES } from '@/server/engine/transfer';

/* 2.20 — the archive format a migration script builds against is written
   from the tables the import checks, and the committed copy may not drift. */

describe('the content archive’s JSON Schema', () => {
  const generated = transferJsonSchema() as { properties: { tables: { properties: Record<string, { items: { required: string[] } }> } } };

  it('matches docs/transfer-schema.json — run `npm run transfer:schema` after a schema change', () => {
    const committed = JSON.parse(readFileSync(path.join(process.cwd(), 'docs', 'transfer-schema.json'), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(generated)));
  });

  it('covers every content table, in insert order, and the settings', () => {
    expect(Object.keys(generated.properties.tables.properties)).toEqual([...CONTENT_TABLES, 'settings']);
  });

  it('asks only for what the import cannot fill in', () => {
    const required = (table: string) => generated.properties.tables.properties[table]!.items.required;
    expect(required('posts')).toEqual(['slug', 'title']);
    expect(required('media')).not.toContain('url');
    expect(required('media')).not.toContain('id');
  });
});
