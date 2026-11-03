import type { Category, StatementMeta, Transaction } from '../types';
import { monthKey, monthLabel } from './format';

export function isSpend(txn: Transaction, categories: Category[]): boolean {
  if (txn.amount <= 0) return false;
  const cat = categories.find((c) => c.id === txn.categoryId);
  if (cat?.isTransfer) return false;
  if (txn.categoryId === 'income') return false;
  return true;
}

export interface MonthTotal {
  month: string;
  label: string;
  total: number;
  count: number;
}

/** Spending per month (charges only, transfers excluded), chronological. */
export function monthlySpendSeries(txns: Transaction[], categories: Category[]): MonthTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    if (!isSpend(t, categories)) continue;
    const k = monthKey(t.transDate);
    const cur = map.get(k) ?? { total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, label: monthLabel(month), total: round2(v.total), count: v.count }));
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  count: number;
  pct: number;
}

export function categoryTotals(txns: Transaction[], categories: Category[]): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const t of txns) {
    if (!isSpend(t, categories)) continue;
    const cur = map.get(t.categoryId) ?? { total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    map.set(t.categoryId, cur);
    grand += t.amount;
  }
  return [...map.entries()]
    .map(([categoryId, v]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name ?? categoryId,
        color: cat?.color ?? '#9ca3af',
        total: round2(v.total),
        count: v.count,
        pct: grand > 0 ? (v.total / grand) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

const PROVINCES = ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'YT', 'NU', 'CA'];
const KNOWN_CITIES = [
  'OTTAWA', 'ORLEANS', 'GLOUCESTER', 'WINCHESTER', 'PERTH', 'TORONTO', 'MONTREAL',
  'KINGSTON', 'KANATA', 'NEPEAN', 'BARRHAVEN', 'VANCOUVER', 'CALGARY', 'EDMONTON',
  'THORNHILL', 'MISSISSAUGA', 'BRAMPTON', 'HAMILTON', 'LONDON', 'GATINEAU',
];

/** Normalize a raw statement description into a stable merchant key. */
export function merchantKey(description: string): string {
  let s = description.toUpperCase().replace(/\s+/g, ' ').trim();
  // Trailing province code
  s = s.replace(new RegExp(`\\s+(${PROVINCES.join('|')})$`), '');
  // Trailing phone number
  s = replaceEnd(s, /\s+\(?\d{3}[).\-\s]?\d{3}[.\-]?\d{4}$/);
  // Trailing store/branch numbers: "#123", "# 123", "1234", "7534-0"
  s = replaceEnd(s, /\s+#\s*\d+$/);
  s = replaceEnd(s, /\s+\d[\d-]*$/);
  // Trailing city (also fused without space, e.g. "INTERNATIOOttawa")
  const cityRe = new RegExp(`(${KNOWN_CITIES.join('|')})$`, 'i');
  s = s.replace(cityRe, '').trim();
  // Trailing order/reference codes containing a digit: "*598X178K0"
  s = replaceEnd(s, /\*[A-Z0-9]*\d[A-Z0-9]*$/);
  // One more pass for city/number after code removal
  s = s.replace(cityRe, '').trim();
  s = replaceEnd(s, /\s+#?\s*\d[\d-]*$/);
  s = s.replace(/\s+/g, ' ').trim();
  return s || description.toUpperCase().slice(0, 24);
}

function replaceEnd(s: string, re: RegExp): string {
  return s.replace(re, '').trim();
}

export interface MerchantTotal {
  key: string;
  display: string;
  total: number;
  count: number;
}

export function topMerchants(txns: Transaction[], categories: Category[], limit = 10): MerchantTotal[] {
  const map = new Map<string, { total: number; count: number; names: Map<string, number> }>();
  for (const t of txns) {
    if (!isSpend(t, categories)) continue;
    const key = merchantKey(t.description);
    const cur = map.get(key) ?? { total: 0, count: 0, names: new Map() };
    cur.total += t.amount;
    cur.count += 1;
    const raw = t.description.replace(/\s+/g, ' ').trim();
    cur.names.set(raw, (cur.names.get(raw) ?? 0) + 1);
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => {
      const display = [...v.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key;
      return { key, display: toTitleCase(display), total: round2(v.total), count: v.count };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s&'/-])([a-z])/g, (_, p1: string, p2: string) => p1 + p2.toUpperCase())
    .replace(/\bCa\b/g, 'ca')
    .replace(/\bA&w\b/g, 'A&W');
}

export interface Kpis {
  monthSpend: number;
  prevMonthSpend: number;
  momPct: number | null;
  avgMonthly: number;
  txnCount: number;
  topCategory: CategoryTotal | null;
  largestTxn: Transaction | null;
}

export function computeKpis(
  txns: Transaction[],
  categories: Category[],
  month: string, // 'yyyy-mm' or 'all'
): Kpis {
  const inMonth = (t: Transaction) => month === 'all' || monthKey(t.transDate) === month;
  const spend = txns.filter((t) => inMonth(t) && isSpend(t, categories));
  const monthSpend = round2(spend.reduce((s, t) => s + t.amount, 0));

  let prevMonthSpend = 0;
  let momPct: number | null = null;
  if (month !== 'all') {
    const [y, m] = month.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    prevMonthSpend = round2(
      txns.filter((t) => monthKey(t.transDate) === prevKey && isSpend(t, categories)).reduce((s, t) => s + t.amount, 0),
    );
    if (prevMonthSpend > 0) momPct = ((monthSpend - prevMonthSpend) / prevMonthSpend) * 100;
  }

  const series = monthlySpendSeries(txns, categories);
  const avgMonthly = series.length > 0 ? round2(series.reduce((s, m) => s + m.total, 0) / series.length) : 0;

  const cats = categoryTotals(spend, categories);
  const largest = spend.length > 0 ? spend.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;

  return {
    monthSpend,
    prevMonthSpend,
    momPct,
    avgMonthly,
    txnCount: spend.length,
    topCategory: cats[0] ?? null,
    largestTxn: largest,
  };
}

export interface BalancePoint {
  date: string;
  label: string;
  balance: number;
  account: string;
}

/** Statement "New Balance" over time, per account. */
export function balanceSeries(statements: StatementMeta[], accounts: { id: string; label: string }[]): BalancePoint[] {
  return statements
    .filter((s) => s.newBalance !== undefined)
    .map((s) => ({
      date: s.statementDate,
      label: monthLabel(s.statementDate.slice(0, 7)),
      balance: s.newBalance!,
      account: accounts.find((a) => a.id === s.accountId)?.label ?? s.accountId,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Category totals per month for a stacked area chart. */
export function categoryByMonth(
  txns: Transaction[],
  categories: Category[],
): { rows: Array<Record<string, string | number>>; cats: Category[] } {
  const spend = txns.filter((t) => isSpend(t, categories));
  const catIds = [...new Set(spend.map((t) => t.categoryId))];
  const cats = catIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => !!c)
    .sort((a, b) => a.name.localeCompare(b.name));
  const byMonth = new Map<string, Record<string, string | number>>();
  for (const t of spend) {
    const k = monthKey(t.transDate);
    const row = byMonth.get(k) ?? { month: k, label: monthLabel(k) };
    row[t.categoryId] = round2(((row[t.categoryId] as number) ?? 0) + t.amount);
    byMonth.set(k, row);
  }
  const rows = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  return { rows, cats };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
