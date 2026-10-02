// Report and postal dates are India business days (IST, UTC+05:30).
// A server in UTC must not treat "2026-10-02" as UTC midnight, and must not
// print a stored instant in the server's zone.

export const INDIA_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET = "+05:30";

export function formatIndiaDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function indiaDayRange(from: string, to: string): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const start = new Date(`${from}T00:00:00.000${INDIA_OFFSET}`);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const end = new Date(`${to}T23:59:59.999${INDIA_OFFSET}`);
    if (!Number.isNaN(end.getTime())) range.lte = end;
  }
  return range.gte || range.lte ? range : undefined;
}

export function csvCell(value: string): string {
  let cell = value;
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}
