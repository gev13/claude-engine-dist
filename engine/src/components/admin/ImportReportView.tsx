'use client';

import { Table, Td, Th } from '@/components/admin/ui';
import { type CheckReport, reportCsv } from '@/lib/importReport';

/* What a content import did, or would do — shared by Export & import and
   Import from WordPress (2.20). */

/** The report as a CSV file, made in the browser — nothing more is asked of the server. */
function downloadReport(report: CheckReport) {
  const blob = new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `import-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Per table: what the archive holds and what the import does with it. */
export function ImportReportView({ report, title }: { report: CheckReport; title: string }) {
  const tables = Object.entries(report.tables);
  const shown = report.rejected.slice(0, 100);
  return (
    <div className="mt-4 border-2 border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[14px] text-bone">{title}</p>
        <button type="button" className="text-[13px] text-flare-soft hover:text-bone" onClick={() => downloadReport(report)}>
          Download the report (CSV)
        </button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Table</Th>
            <Th>In the archive</Th>
            <Th>New</Th>
            <Th>Updated</Th>
            <Th>Skipped</Th>
            <Th>Refused</Th>
          </tr>
        </thead>
        <tbody>
          {tables.map(([table, t]) => (
            <tr key={table}>
              <Td>
                {table.replace(/_/g, ' ')}
                {t.ignoredColumns.length > 0 && (
                  <span className="block text-[11px] text-smoke">ignored: {t.ignoredColumns.join(', ')}</span>
                )}
              </Td>
              <Td>{t.total}</Td>
              <Td>{t.create}</Td>
              <Td>{t.update}</Td>
              <Td>{t.skip}</Td>
              <Td>{t.failed > 0 ? <strong className="text-flare-soft">{t.failed}</strong> : 0}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {report.rejected.length > 0 && (
        <div className="mt-4">
          <p className="m-0 mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Refused — {report.rejected.length}</p>
          <ul className="m-0 flex max-h-[320px] list-none flex-col gap-1 overflow-y-auto p-0 text-[13px]">
            {shown.map((r) => (
              <li key={`${r.table}-${r.row}`} className="text-ash">
                <span className="font-mono text-[12px] text-smoke">
                  {r.table.replace(/_/g, ' ')} #{r.row}
                </span>{' '}
                <span className="text-bone">{r.key}</span> — {r.reason}
              </li>
            ))}
          </ul>
          {report.rejected.length > shown.length && (
            <p className="m-0 mt-2 text-[12px] text-smoke">…and {report.rejected.length - shown.length} more, all in the CSV.</p>
          )}
        </div>
      )}
      {report.notes.length > 0 && (
        <p className="m-0 mt-3 text-[12px] text-smoke">
          {report.notes.length} row(s) had a reference to something missing, which was cleared — listed in the CSV.
        </p>
      )}
    </div>
  );
}

