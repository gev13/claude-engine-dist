import { toCsv } from './csv';

/* What a content import did, or would do, to each table (2.20) — shared by
   the server, which writes it, and the Transfer screen, which shows it and
   offers it as a CSV. */

export type ImportStrategy = 'replace' | 'merge';

export type Rejection = { table: string; row: number; key: string; reason: string };

export type TableReport = { total: number; create: number; update: number; skip: number; failed: number; ignoredColumns: string[] };

export type CheckReport = {
  strategy: ImportStrategy;
  tables: Record<string, TableReport>;
  rejected: Rejection[];
  notes: { table: string; row: number; key: string; note: string }[];
};

export function reportTotals(report: CheckReport): { create: number; update: number; skip: number; failed: number } {
  const sum = { create: 0, update: 0, skip: 0, failed: 0 };
  for (const t of Object.values(report.tables)) {
    sum.create += t.create;
    sum.update += t.update;
    sum.skip += t.skip;
    sum.failed += t.failed;
  }
  return sum;
}

/**
 * The report as a spreadsheet: one line per table with its counts, then one
 * per refused row and one per row changed on the way in. Cells go through
 * `csvCell`, so a slug starting with "=" cannot become a formula.
 */
export function reportCsv(report: CheckReport): string {
  const rows: unknown[][] = [];
  for (const [table, t] of Object.entries(report.tables)) {
    rows.push([table, '', '', 'summary', `${t.total} in the archive: ${t.create} created, ${t.update} updated, ${t.skip} skipped, ${t.failed} refused`]);
    if (t.ignoredColumns.length) rows.push([table, '', '', 'ignored columns', t.ignoredColumns.join(', ')]);
  }
  for (const r of report.rejected) rows.push([r.table, r.row, r.key, 'refused', r.reason]);
  for (const n of report.notes) rows.push([n.table, n.row, n.key, 'changed', n.note]);
  return toCsv(['table', 'row', 'item', 'outcome', 'detail'], rows);
}
