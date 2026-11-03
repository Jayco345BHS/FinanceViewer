/**
 * Parser for Scotiabank credit card eStatement PDFs (e.g. Scotiabank Passport
 * Visa Infinite). Operates on plain text lines so it can be unit-tested
 * without pdf.js; see extract.ts for PDF -> lines.
 *
 * Statement transaction rows look like either:
 *   001 / Sep 17 / Sep 18 / CORNER KITCHENS OTTAWA ON / 7.18      (split lines)
 *   001 Sep 17 Sep 18 CORNER KITCHENS OTTAWA ON 7.18              (single line)
 * Credits (payments/refunds) have a trailing "-" after the amount, either on
 * the same line or the next one. Foreign-currency charges embed
 * "AMT 144.00 USD" in the details.
 */

export interface ParsedTransaction {
  ref: string;
  /** ISO yyyy-mm-dd */
  transDate: string;
  postDate: string;
  description: string;
  /** Positive = charge, negative = payment/credit. */
  amount: number;
  foreignAmount?: number;
  foreignCurrency?: string;
}

export interface ParsedStatement {
  cardName?: string;
  accountLast4?: string;
  periodStart?: string;
  periodEnd?: string;
  statementDate?: string;
  previousBalance?: number;
  paymentsCredits?: number;
  purchasesCharges?: number;
  interestCharged?: number;
  newBalance?: number;
  creditLimit?: number;
  availableCredit?: number;
  minPayment?: number;
  dueDate?: string;
  subtotalCredits?: number;
  subtotalDebits?: number;
  transactions: ParsedTransaction[];
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MONTH_RE = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';

type Token =
  | { type: 'ref'; value: string }
  | { type: 'date'; month: number; day: number; raw: string }
  | { type: 'amount'; value: number }
  | { type: 'minus' }
  | { type: 'text'; value: string };

function parseMoney(s: string): number {
  return parseFloat(s.replace(/[$,]/g, ''));
}

function monthNum(m: string): number | undefined {
  return MONTHS[m.slice(0, 3).toLowerCase()];
}

/** Classify one raw text line into zero or more tokens. */
function tokenizeLine(line: string): Token[] {
  const t = line.trim();
  if (!t) return [];

  // Whole transaction on one line: "001 Sep 17 Sep 18 DETAILS... 7.18" (+ optional trailing "-",
  // which may be fused to the amount: "80.00-")
  const row = t.match(
    new RegExp(
      `^(\\d{3})\\s+${MONTH_RE}\\s+(\\d{1,2})\\s+${MONTH_RE}\\s+(\\d{1,2})\\s+(.+?)\\s+([\\d,]+\\.\\d{2})\\s*(-)?$`,
      'i',
    ),
  );
  if (row) {
    const tokens: Token[] = [
      { type: 'ref', value: row[1] },
      { type: 'date', month: monthNum(row[2])!, day: Number(row[3]), raw: `${row[2]} ${row[3]}` },
      { type: 'date', month: monthNum(row[4])!, day: Number(row[5]), raw: `${row[4]} ${row[5]}` },
    ];
    const details = row[6].trim();
    if (details) tokens.push({ type: 'text', value: details });
    tokens.push({ type: 'amount', value: parseMoney(row[7]) });
    if (row[8]) tokens.push({ type: 'minus' });
    return tokens;
  }

  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{3})$/))) return [{ type: 'ref', value: m[1] }];

  if ((m = t.match(new RegExp(`^${MONTH_RE}\\s+(\\d{1,2})$`, 'i')))) {
    const mon = monthNum(m[1]);
    if (mon !== undefined) {
      return [{ type: 'date', month: mon, day: Number(m[2]), raw: t }];
    }
  }

  // "80.00 -" or "80.00-" on one line
  if ((m = t.match(/^-?\$?([\d,]+\.\d{2})\s*-$/))) {
    return [{ type: 'amount', value: parseMoney(m[1]) }, { type: 'minus' }];
  }
  if ((m = t.match(/^(-?)\$?([\d,]+\.\d{2})$/))) {
    const v = parseMoney(m[2]);
    return [{ type: 'amount', value: m[1] === '-' ? -v : v }];
  }
  if (t === '-') return [{ type: 'minus' }];

  return [{ type: 'text', value: t }];
}

const TXN_SECTION_START = /REF\.?\s*#|TRANS\.?\s*DATE|Transactions since your last statement|Transactions\s*-\s*continued/i;
const TXN_SECTION_END = /SUB-TOTAL|Interest charges posted|Special\s*offers?\s*summary/i;
const FOREIGN_RE = /\bAMT\s+([\d,]+\.\d{2})\s+([A-Z]{3})\b/;

/** True for page furniture lines that may appear between transactions. */
function isBoilerplate(text: string): boolean {
  return (
    /^(Scotiabank|Visa|Mastercard|American Express)/i.test(text) ||
    /^Statement\s*(Period|Date)$/i.test(text) ||
    /^Account\s*#?$/i.test(text) ||
    /^Page\s*\d+\s*(of\s*\d+)?$/i.test(text) ||
    /^\d+\s*of\s*\d+$/i.test(text) ||
    /^Transactions\s*-\s*continued$/i.test(text) ||
    /^Continued\s*on\s*(next\s*)?(page)?/i.test(text) ||
    /^REF\.?#?$/i.test(text) ||
    /^(TRANS\.?|POST)$/i.test(text) ||
    /^DATE$/i.test(text) ||
    /^DETAILS$/i.test(text) ||
    /^AMOUNT\s*\(\$\)$/i.test(text) ||
    /^\d{4}\s+X{2,}/i.test(text) // masked account number line
  );
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Pick the year for a month/day txn date given the statement period. */
function resolveYear(
  month: number,
  day: number,
  periodStart?: { year: number; month: number },
  periodEnd?: { year: number; month: number },
): number {
  if (!periodStart || !periodEnd) return new Date().getFullYear();
  // Statement periods are ~1 month and can span a year boundary (Dec -> Jan).
  // A txn month matching the start month belongs to the start year, etc.
  if (month === periodStart.month) return periodStart.year;
  if (month === periodEnd.month) return periodEnd.year;
  // Fallback: pick the candidate date closest to the period.
  const candidates = [periodStart.year, periodEnd.year].map((y) => ({
    y,
    dist: Math.abs(new Date(y, month, day).getTime() - new Date(periodStart.year, periodStart.month, 1).getTime()),
  }));
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0].y;
}

function parseDateText(s: string): { year: number; month: number; day: number } | undefined {
  const m = s.match(new RegExp(`^${MONTH_RE}\\s+(\\d{1,2}),\\s*(\\d{4})$`, 'i'));
  if (!m) return undefined;
  return { year: Number(m[3]), month: monthNum(m[1])!, day: Number(m[2]) };
}

function moneyAfter(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  return m ? parseMoney(m[1]) : undefined;
}

function dateAfter(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  if (!m) return undefined;
  const d = parseDateText(m[1]);
  return d ? toIso(d.year, d.month, d.day) : undefined;
}

export function parseScotiaCreditStatement(lines: string[]): ParsedStatement {
  const text = lines.join('\n');
  const warnings: string[] = [];

  // ---- Statement metadata -------------------------------------------------
  const stmt: ParsedStatement = { transactions: [], warnings };

  // \bCard\b so "Cardmembers" in legal text doesn't match.
  const card = text.match(/(Scotiabank[\s\S]{0,60}?\bCard\b)/);
  if (card) {
    stmt.cardName = card[1].replace(/[®™*]/g, '').replace(/\s+/g, ' ').trim();
  }

  const acct = text.match(/Account\s*#\s*([0-9Xx* ]{4,30})/);
  if (acct) {
    const digits = acct[1].replace(/\D/g, '');
    if (digits.length >= 4) stmt.accountLast4 = digits.slice(-4);
  }

  const period = text.match(
    new RegExp(`Statement\\s*Period\\s*(${MONTH_RE}\\s+\\d{1,2},\\s*\\d{4})\\s*-\\s*(${MONTH_RE}\\s+\\d{1,2},\\s*\\d{4})`, 'i'),
  );
  let periodStart: { year: number; month: number } | undefined;
  let periodEnd: { year: number; month: number } | undefined;
  if (period) {
    // Groups: 1 = first date, 2 = its month (inner MONTH_RE group),
    // 3 = second date, 4 = its month.
    const s = parseDateText(period[1]);
    const e = parseDateText(period[3]);
    if (s && e) {
      stmt.periodStart = toIso(s.year, s.month, s.day);
      stmt.periodEnd = toIso(e.year, e.month, e.day);
      periodStart = { year: s.year, month: s.month };
      periodEnd = { year: e.year, month: e.month };
    }
  }

  stmt.statementDate = dateAfter(text, new RegExp(`Statement\\s*Date\\s*(${MONTH_RE}\\s+\\d{1,2},\\s*\\d{4})`, 'i'));
  stmt.dueDate = dateAfter(text, new RegExp(`Payment\\s*Due\\s*Date\\s*(${MONTH_RE}\\s+\\d{1,2},\\s*\\d{4})`, 'i'));

  stmt.previousBalance = moneyAfter(text, /Previous\s*balance[,\s]+[A-Za-z]{3}\s*\d{1,2}\s*\/\s*\d{2}\s*\$?([\d,]+\.\d{2})/);
  stmt.paymentsCredits = moneyAfter(text, /Payments\s*\/\s*credits\s*-\s*\$?([\d,]+\.\d{2})/);
  stmt.purchasesCharges = moneyAfter(text, /Purchases\s*\/\s*charges\s*\+\s*\$?([\d,]+\.\d{2})/);
  stmt.interestCharged = moneyAfter(text, /Interest\s*\+\s*\$?([\d,]+\.\d{2})/);
  stmt.newBalance = moneyAfter(text, /New\s*Balance[\s\S]{0,20}?([\d,]+\.\d{2})/);
  stmt.creditLimit = moneyAfter(text, /Credit\s*limit\s*\$?([\d,]+\.\d{2})/);
  stmt.availableCredit = moneyAfter(text, /Available\s*credit\s*\$?([\d,]+\.\d{2})/);
  stmt.minPayment = moneyAfter(text, /Total\s*Minimum\s*Payment\s*\$?([\d,]+\.\d{2})/);

  // Subtotals. Two observed layouts:
  //  A) "SUB-TOTAL CREDITS - <acct> $1,580.00-" / "SUB-TOTAL DEBITS - <acct> $2,420.59"
  //  B) "SUB-TOTAL CREDITS - <acct> SUB-TOTAL DEBITS - <acct> $1,580.00 $2,420.59"
  const creditsIdx = text.search(/SUB-TOTAL\s*CREDITS/i);
  const debitsIdx = text.search(/SUB-TOTAL\s*DEBITS/i);
  if (creditsIdx >= 0 && debitsIdx >= 0) {
    const between = text.slice(creditsIdx, debitsIdx);
    const after = text.slice(debitsIdx);
    const amountsBetween = [...between.matchAll(/\$?([\d,]+\.\d{2})/g)].map((m) => parseMoney(m[1]));
    const amountsAfter = [...after.matchAll(/\$?([\d,]+\.\d{2})/g)].map((m) => parseMoney(m[1]));
    if (amountsBetween.length >= 1 && amountsAfter.length >= 1) {
      stmt.subtotalCredits = amountsBetween[0];
      stmt.subtotalDebits = amountsAfter[0];
    } else if (amountsAfter.length >= 2) {
      stmt.subtotalCredits = amountsAfter[0];
      stmt.subtotalDebits = amountsAfter[1];
    }
  }

  // ---- Transactions -------------------------------------------------------
  const tokens: Token[] = [];
  let inSection = false;
  for (const line of lines) {
    if (!inSection && TXN_SECTION_START.test(line)) inSection = true;
    if (!inSection) continue;
    if (TXN_SECTION_END.test(line)) break;
    tokens.push(...tokenizeLine(line));
  }

  type State = 'scan' | 'date1' | 'date2' | 'details';
  let state: State = 'scan';
  let cur: {
    ref: string;
    trans?: { month: number; day: number };
    post?: { month: number; day: number };
    details: string[];
  } | null = null;
  let pendingAmountIdx = -1; // index in stmt.transactions of txn awaiting possible minus

  const flush = () => {
    if (!cur || !cur.trans || !cur.post) {
      cur = null;
      return;
    }
    const yT = resolveYear(cur.trans.month, cur.trans.day, periodStart, periodEnd);
    const yP = resolveYear(cur.post.month, cur.post.day, periodStart, periodEnd);
    let description = cur.details.join(' ').replace(/\s+/g, ' ').trim();
    let foreignAmount: number | undefined;
    let foreignCurrency: string | undefined;
    const fx = description.match(FOREIGN_RE);
    if (fx) {
      foreignAmount = parseMoney(fx[1]);
      foreignCurrency = fx[2];
      description = description.replace(FOREIGN_RE, '').replace(/\s+/g, ' ').trim();
    }
    stmt.transactions.push({
      ref: cur.ref,
      transDate: toIso(yT, cur.trans.month, cur.trans.day),
      postDate: toIso(yP, cur.post.month, cur.post.day),
      description,
      amount: 0, // set by amount token
      foreignAmount,
      foreignCurrency,
    });
    pendingAmountIdx = -1;
    cur = null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    switch (state) {
      case 'scan': {
        // Attach stray foreign-amount lines to the previous transaction.
        if (tok.type === 'text' && stmt.transactions.length > 0) {
          const fx = tok.value.match(FOREIGN_RE);
          if (fx) {
            const last = stmt.transactions[stmt.transactions.length - 1];
            if (last.foreignAmount === undefined) {
              last.foreignAmount = parseMoney(fx[1]);
              last.foreignCurrency = fx[2];
            }
            break;
          }
        }
        if (tok.type === 'ref') {
          cur = { ref: tok.value, details: [] };
          state = 'date1';
        }
        break;
      }
      case 'date1': {
        if (tok.type === 'date' && cur) {
          cur.trans = { month: tok.month, day: tok.day };
          state = 'date2';
        } else {
          cur = null;
          state = 'scan';
          if (tok.type === 'ref') i--; // reprocess
        }
        break;
      }
      case 'date2': {
        if (tok.type === 'date' && cur) {
          cur.post = { month: tok.month, day: tok.day };
          state = 'details';
        } else {
          cur = null;
          state = 'scan';
          if (tok.type === 'ref') i--;
        }
        break;
      }
      case 'details': {
        if (!cur) {
          state = 'scan';
          break;
        }
        if (tok.type === 'amount') {
          let value = tok.value;
          if (tokens[i + 1]?.type === 'minus') {
            value = -Math.abs(value);
            i++;
          }
          flush();
          const txn = stmt.transactions[stmt.transactions.length - 1];
          if (txn) txn.amount = value;
          pendingAmountIdx = stmt.transactions.length - 1;
          state = 'scan';
        } else if (tok.type === 'ref') {
          // Malformed previous txn; drop it and start fresh.
          cur = { ref: tok.value, details: [] };
          state = 'date1';
        } else if (tok.type === 'text') {
          if (!isBoilerplate(tok.value)) cur.details.push(tok.value);
        } else if (tok.type === 'date') {
          cur.details.push(tok.raw);
        }
        break;
      }
    }
  }
  void pendingAmountIdx;

  // ---- Cross-checks ---------------------------------------------------------
  const credits = stmt.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + -t.amount, 0);
  const debits = stmt.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const close = (a: number, b: number) => Math.abs(a - b) < 0.02;

  if (stmt.subtotalCredits !== undefined && !close(credits, stmt.subtotalCredits)) {
    warnings.push(
      `Parsed credits (${credits.toFixed(2)}) do not match statement subtotal (${stmt.subtotalCredits.toFixed(2)}).`,
    );
  }
  if (stmt.subtotalDebits !== undefined && !close(debits, stmt.subtotalDebits)) {
    warnings.push(
      `Parsed debits (${debits.toFixed(2)}) do not match statement subtotal (${stmt.subtotalDebits.toFixed(2)}).`,
    );
  }
  if (stmt.transactions.length === 0) {
    warnings.push('No transactions found — is this a Scotiabank credit card statement?');
  }
  if (!stmt.statementDate) warnings.push('Could not read the statement date.');

  return stmt;
}
