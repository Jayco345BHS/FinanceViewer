/**
 * Generic CSV importer for bank account (debit) exports, e.g. Scotiabank
 * online banking "Download transactions". Column layout is user-mappable
 * with header-name auto-detection.
 *
 * Amount convention matches the rest of the app: positive = money out
 * (spending), negative = money in (deposits).
 */
import Papa from 'papaparse';

export interface CsvMapping {
  /** Column index for the date. */
  date: number;
  /** Column index for the description. */
  description: number;
  /** Single signed amount column, or -1 if using debit/credit columns. */
  amount: number;
  /** Money-out column (positive numbers), or -1. */
  debit: number;
  /** Money-in column (positive numbers), or -1. */
  credit: number;
  hasHeader: boolean;
  dateFormat: 'auto' | 'ymd' | 'mdy' | 'dmy';
  /** Bank CSVs often use negative for money out; 'invert' flips signs. */
  sign: 'normal' | 'invert';
}

export const DEFAULT_MAPPING: CsvMapping = {
  date: 0,
  description: 1,
  amount: 2,
  debit: -1,
  credit: -1,
  hasHeader: true,
  dateFormat: 'auto',
  sign: 'invert',
};

export interface ParsedCsvRow {
  date: string;
  description: string;
  amount: number;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: string[];
  headers: string[];
  sampleRows: string[][];
}

export function parseCsvRaw(text: string): string[][] {
  const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  return res.data;
}

const DATE_HEADER = /^(date|transaction date|posted date|posting date|trans date)$/i;
const DESC_HEADER = /^(description|details|payee|transaction|merchant|memo|narrative)$/i;
const AMOUNT_HEADER = /^(amount|amt|value|total)$/i;
const DEBIT_HEADER = /^(debit|withdrawal|withdrawals|money out|out)$/i;
const CREDIT_HEADER = /^(credit|deposit|deposits|money in|in)$/i;

/** Best-effort column detection from a header row. */
export function guessMapping(headers: string[]): CsvMapping {
  const m = { ...DEFAULT_MAPPING };
  headers.forEach((h, i) => {
    const t = h.trim();
    if (DATE_HEADER.test(t)) m.date = i;
    else if (DESC_HEADER.test(t)) m.description = i;
    else if (AMOUNT_HEADER.test(t)) m.amount = i;
    else if (DEBIT_HEADER.test(t)) m.debit = i;
    else if (CREDIT_HEADER.test(t)) m.credit = i;
  });
  if (m.debit >= 0 || m.credit >= 0) m.amount = -1;
  return m;
}

function parseDateValue(raw: string, format: CsvMapping['dateFormat']): string | null {
  const t = raw.trim();
  let m: RegExpMatchArray | null;

  const tryFormats: Array<'ymd' | 'mdy' | 'dmy'> =
    format === 'auto' ? ['ymd', 'mdy', 'dmy'] : [format];

  for (const f of tryFormats) {
    if (f === 'ymd' && (m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) {
      return iso(Number(m[1]), Number(m[2]), Number(m[3]));
    }
    if (f === 'mdy' && (m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) {
      return iso(Number(m[3]), Number(m[1]), Number(m[2]));
    }
    if (f === 'dmy' && (m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) {
      return iso(Number(m[3]), Number(m[2]), Number(m[1]));
    }
  }
  // "Jan 5, 2026"
  if ((m = t.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/))) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mi = months.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return iso(Number(m[3]), mi + 1, Number(m[2]));
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/[$,\s]/g, '');
  if (!t) return null;
  // "(123.45)" accounting negative
  const paren = t.match(/^\(([\d.]+)\)$/);
  if (paren) return -parseFloat(paren[1]);
  const v = parseFloat(t);
  return Number.isNaN(v) ? null : v;
}

export function parseCsv(text: string, mapping: CsvMapping): CsvParseResult {
  const grid = parseCsvRaw(text);
  const errors: string[] = [];
  const rows: ParsedCsvRow[] = [];

  if (grid.length === 0) {
    return { rows, errors: ['No rows found in file.'], headers: [], sampleRows: [] };
  }

  const headers = mapping.hasHeader ? grid[0].map((h) => h.trim()) : [];
  const dataRows = mapping.hasHeader ? grid.slice(1) : grid;

  dataRows.forEach((cols, idx) => {
    const lineNo = idx + (mapping.hasHeader ? 2 : 1);
    const get = (i: number) => (i >= 0 && i < cols.length ? cols[i] : '');

    const date = parseDateValue(get(mapping.date), mapping.dateFormat);
    if (!date) {
      errors.push(`Row ${lineNo}: unparseable date "${get(mapping.date)}"`);
      return;
    }
    const description = get(mapping.description).trim() || '(no description)';

    let amount: number | null = null;
    if (mapping.amount >= 0) {
      amount = parseAmount(get(mapping.amount));
    } else {
      const debit = parseAmount(get(mapping.debit));
      const credit = parseAmount(get(mapping.credit));
      if (debit !== null || credit !== null) {
        amount = Math.abs(debit ?? 0) - Math.abs(credit ?? 0);
      }
    }
    if (amount === null) {
      errors.push(`Row ${lineNo}: unparseable amount`);
      return;
    }
    if (mapping.sign === 'invert') amount = -amount;
    rows.push({ date, description, amount });
  });

  return { rows, errors, headers, sampleRows: grid.slice(0, 6) };
}
