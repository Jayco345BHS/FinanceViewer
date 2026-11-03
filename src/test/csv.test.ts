import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsv, DEFAULT_MAPPING } from '../lib/csv';
import type { CsvMapping } from '../lib/csv';

describe('parseCsv', () => {
  it('parses header + signed amounts with bank sign convention', () => {
    const text = ['Date,Description,Amount', '01/15/2026,SOBEYS 4154,-52.10', '01/16/2026,PAYROLL DEPOSIT,1500.00'].join('\n');
    const mapping: CsvMapping = { ...DEFAULT_MAPPING, hasHeader: true, sign: 'invert' };
    const res = parseCsv(text, mapping);
    expect(res.errors).toHaveLength(0);
    expect(res.rows).toHaveLength(2);
    // Bank style: -52.10 means money out → +52.10 spend
    expect(res.rows[0]).toEqual({ date: '2026-01-15', description: 'SOBEYS 4154', amount: 52.1 });
    expect(res.rows[1].amount).toBe(-1500);
  });

  it('supports separate debit/credit columns', () => {
    const text = ['Date,Details,Debit,Credit', '2026-02-01,COFFEE SHOP,4.50,', '2026-02-02,REFUND,,9.99'].join('\n');
    const mapping: CsvMapping = { ...DEFAULT_MAPPING, date: 0, description: 1, amount: -1, debit: 2, credit: 3, hasHeader: true, sign: 'normal' };
    const res = parseCsv(text, mapping);
    expect(res.rows[0].amount).toBe(4.5);
    expect(res.rows[1].amount).toBe(-9.99);
  });

  it('handles ISO and mdy date formats in auto mode', () => {
    const text = ['2026-03-05,TEST A,10.00', '05/03/2026,TEST B,20.00'].join('\n');
    const mapping: CsvMapping = { ...DEFAULT_MAPPING, hasHeader: false, sign: 'normal', dateFormat: 'auto' };
    const res = parseCsv(text, mapping);
    expect(res.rows[0].date).toBe('2026-03-05');
    // auto tries mdy before dmy: 05/03 → May 3
    expect(res.rows[1].date).toBe('2026-05-03');
  });

  it('honours explicit dmy date format', () => {
    const text = '05/03/2026,TEST B,20.00';
    const mapping: CsvMapping = { ...DEFAULT_MAPPING, hasHeader: false, sign: 'normal', dateFormat: 'dmy' };
    const res = parseCsv(text, mapping);
    expect(res.rows[0].date).toBe('2026-03-05');
  });

  it('collects errors for bad rows and skips them', () => {
    const text = ['Date,Description,Amount', 'not-a-date,BAD ROW,5.00', '2026-01-01,GOOD ROW,5.00'].join('\n');
    const res = parseCsv(text, { ...DEFAULT_MAPPING, hasHeader: true, sign: 'normal' });
    expect(res.rows).toHaveLength(1);
    expect(res.errors).toHaveLength(1);
  });
});

describe('guessMapping', () => {
  it('detects columns by header name', () => {
    const m = guessMapping(['Date', 'Description', 'Debit', 'Credit']);
    expect(m.date).toBe(0);
    expect(m.description).toBe(1);
    expect(m.debit).toBe(2);
    expect(m.credit).toBe(3);
    expect(m.amount).toBe(-1);
  });

  it('detects a single amount column', () => {
    const m = guessMapping(['Posted Date', 'Payee', 'Amount']);
    expect(m.date).toBe(0);
    expect(m.description).toBe(1);
    expect(m.amount).toBe(2);
  });
});
