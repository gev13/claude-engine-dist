import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { transferJsonSchema } from '@/server/engine/transferSchema';

/** Writes docs/transfer-schema.json from the table definitions. Run after a schema change. */
const target = path.join(process.cwd(), 'docs', 'transfer-schema.json');
writeFileSync(target, `${JSON.stringify(transferJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), target)}.`);
