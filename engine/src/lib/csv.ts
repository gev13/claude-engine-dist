/**
 * One CSV cell. Always quoted, with quotes doubled; a value that starts with
 * =, +, -, @, a tab or a carriage return gets a leading apostrophe so a
 * spreadsheet shows it as text instead of running it as a formula. Visitor
 * input ends up in these files, so that matters.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A whole CSV document, CRLF line endings as RFC 4180 has them. */
export function toCsv(head: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
