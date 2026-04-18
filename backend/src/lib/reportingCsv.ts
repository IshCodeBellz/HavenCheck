import { escapeCsvField } from './marReports';

export function csvFromTable(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = headers.map((h) => escapeCsvField(h)).join(',');
  const lines = rows.map((row) => row.map((c) => escapeCsvField(c ?? '')).join(','));
  return [head, ...lines].join('\r\n');
}
