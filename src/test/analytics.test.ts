import { describe, expect, it } from 'vitest';
import { categoryTotals, computeKpis, merchantKey, monthlySpendSeries, topMerchants } from '../lib/analytics';
import { DEFAULT_CATEGORIES } from '../lib/categorize';
import type { Transaction } from '../types';

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    accountId: 'cc-1',
    source: 'pdf-cc',
    transDate: '2026-01-15',
    postDate: '2026-01-15',
    description: 'TEST',
    amount: 10,
    categoryId: 'other',
    categoryOverridden: false,
    ...partial,
  };
}

describe('monthlySpendSeries', () => {
  it('sums charges per month, excluding payments and income', () => {
    const txns = [
      txn({ transDate: '2026-01-10', amount: 100, categoryId: 'groceries' }),
      txn({ transDate: '2026-01-20', amount: 50, categoryId: 'dining' }),
      txn({ transDate: '2026-01-25', amount: -200, categoryId: 'transfers' }), // payment
      txn({ transDate: '2026-02-05', amount: 25, categoryId: 'transit' }),
      txn({ transDate: '2026-02-06', amount: 500, categoryId: 'transfers' }), // transfer out, excluded
    ];
    const series = monthlySpendSeries(txns, DEFAULT_CATEGORIES);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ month: '2026-01', total: 150, count: 2 });
    expect(series[1]).toMatchObject({ month: '2026-02', total: 25, count: 1 });
  });
});

describe('categoryTotals', () => {
  it('computes totals and percentages', () => {
    const txns = [
      txn({ amount: 75, categoryId: 'groceries' }),
      txn({ amount: 25, categoryId: 'dining' }),
      txn({ amount: -10, categoryId: 'groceries' }), // refund excluded
    ];
    const totals = categoryTotals(txns, DEFAULT_CATEGORIES);
    expect(totals[0]).toMatchObject({ categoryId: 'groceries', total: 75, pct: 75 });
    expect(totals[1]).toMatchObject({ categoryId: 'dining', total: 25, pct: 25 });
  });
});

describe('merchantKey', () => {
  const cases: Array<[string, string]> = [
    ['SOBEYS 4154              ORLEANS      ON', 'SOBEYS'],
    ['TIM HORTONS #7366        ORLEANS      ON', 'TIM HORTONS'],
    ['SUBWAY 7534-0            OTTAWA       ON', 'SUBWAY'],
    ['SQ *MANHATTANS INTERNATIOOttawa       ON', 'SQ *MANHATTANS INTERNATIO'],
    ['Amazon.ca*598X178K0      866-216-1072 ON', 'AMAZON.CA'],
    ['OCT*L6P2MZRM43994R       OTTAWA       ON', 'OCT'],
    ['CAA*MEMBERSHIP           613-820-1890 ON', 'CAA*MEMBERSHIP'],
    ['PET VALU #2293           WINCHESTER   ON', 'PET VALU'],
    ['PIZZA PIZZA # 226        OTTAWA       ON', 'PIZZA PIZZA'],
  ];

  it.each(cases)('%s → %s', (input, expected) => {
    expect(merchantKey(input)).toBe(expected);
  });
});

describe('topMerchants', () => {
  it('groups normalized merchants and sorts by total', () => {
    const txns = [
      txn({ description: 'SOBEYS 4154 ORLEANS ON', amount: 50, categoryId: 'groceries' }),
      txn({ description: 'SOBEYS 4154 ORLEANS ON', amount: 70, categoryId: 'groceries' }),
      txn({ description: 'TIM HORTONS #7366 ORLEANS ON', amount: 5, categoryId: 'dining' }),
    ];
    const top = topMerchants(txns, DEFAULT_CATEGORIES);
    expect(top[0]).toMatchObject({ key: 'SOBEYS', total: 120, count: 2 });
    expect(top[1]).toMatchObject({ key: 'TIM HORTONS', total: 5 });
  });
});

describe('computeKpis', () => {
  it('computes month-over-month change', () => {
    const txns = [
      txn({ transDate: '2026-01-10', amount: 100, categoryId: 'groceries' }),
      txn({ transDate: '2026-02-10', amount: 150, categoryId: 'groceries' }),
    ];
    const k = computeKpis(txns, DEFAULT_CATEGORIES, '2026-02');
    expect(k.monthSpend).toBe(150);
    expect(k.prevMonthSpend).toBe(100);
    expect(k.momPct).toBe(50);
    expect(k.topCategory?.categoryId).toBe('groceries');
    expect(k.largestTxn?.amount).toBe(150);
  });
});
