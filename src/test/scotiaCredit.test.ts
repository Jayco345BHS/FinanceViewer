import { describe, expect, it } from 'vitest';
import { parseScotiaCreditStatement } from '../lib/pdf/scotiaCredit';

// Synthetic statement in "split-line" layout (one field per line).
const SPLIT_LINES = [
  'Scotiabank Passport',
  'Visa Infinite +* Card',
  'Statement',
  'Period',
  'Jan 18, 2026',
  '-',
  'Feb 17, 2026',
  'Statement',
  'Date',
  'Feb 17, 2026',
  'Account',
  '#',
  '1234 XXXX XXXX 5678',
  'Page',
  '1',
  'of',
  '2',
  'Payment',
  'Due',
  'Date',
  'Mar 9, 2026',
  'Total',
  'Minimum',
  'Payment',
  '$10.00',
  'New',
  'Balance',
  '=',
  '$114.54',
  'Previous balance,',
  'Jan 17/26',
  '$100.00',
  'Interest',
  '+',
  '$0.00',
  'Payments/credits',
  '-',
  '$50.00',
  'Purchases/charges',
  '+',
  '$64.54',
  'Credit',
  'limit',
  '$5,000.00',
  'Available',
  'credit',
  '$4,885.46',
  'Transactions since your last statement',
  'REF.#',
  'TRANS.',
  'DATE',
  'POST',
  'DATE',
  'DETAILS',
  'AMOUNT($)',
  '001',
  'Jan 20',
  'Jan 21',
  'SOBEYS 4154              ORLEANS      ON',
  '50.25',
  '002',
  'Jan 21',
  'Jan 22',
  'PAYMENT FROM - *****01*9586',
  '50.00',
  '-',
  '003',
  'Jan 22',
  'Jan 23',
  'GRAMMARLY CO*ORLHCTB',
  'GRAMMARLY.COMCA',
  'AMT 10.00 USD',
  '14.29',
  'Continued',
  'on',
  'next',
  'page',
  'Transactions',
  '-',
  'continued',
  'REF.#',
  'TRANS.',
  'DATE',
  'POST',
  'DATE',
  'DETAILS',
  'AMOUNT($)',
  '004',
  'Feb 2',
  'Feb 3',
  'OCT*L6P2MZRM43994R       OTTAWA       ON',
  '8.20',
  'SUB-TOTAL CREDITS',
  '-',
  '1234 XXXX XXXX 5678',
  'SUB-TOTAL DEBITS',
  '-',
  '1234 XXXX XXXX 5678',
  '$50.00',
  '$72.74',
];

// Same statement in "merged-line" layout (whole row on one line).
const MERGED_LINES = [
  'Scotiabank Passport Visa Infinite + Card',
  'Statement Period Jan 18, 2026 - Feb 17, 2026',
  'Statement Date Feb 17, 2026',
  'Account # 1234 XXXX XXXX 5678',
  'Page 1 of 1',
  'Payment Due Date Mar 9, 2026',
  'Total Minimum Payment $10.00',
  'New Balance = $114.54',
  'Previous balance, Jan 17/26 $100.00',
  'Payments/credits - $50.00',
  'Purchases/charges + $64.54',
  'Interest + $0.00',
  'Credit limit $5,000.00',
  'Available credit $4,885.46',
  'Transactions since your last statement',
  'REF.# TRANS. DATE POST DATE DETAILS AMOUNT($)',
  '001 Jan 20 Jan 21 SOBEYS 4154              ORLEANS      ON 50.25',
  '002 Jan 21 Jan 22 PAYMENT FROM - *****01*9586 50.00 -',
  '003 Jan 22 Jan 23 GRAMMARLY CO*ORLHCTB 14.29',
  'AMT 10.00 USD',
  '004 Feb 2 Feb 3 OCT*L6P2MZRM43994R       OTTAWA       ON 8.20',
  'SUB-TOTAL CREDITS - 1234 XXXX XXXX 5678',
  'SUB-TOTAL DEBITS - 1234 XXXX XXXX 5678',
  '$50.00 $72.74',
];

describe('parseScotiaCreditStatement — split-line layout', () => {
  const stmt = parseScotiaCreditStatement(SPLIT_LINES);

  it('reads statement metadata', () => {
    expect(stmt.accountLast4).toBe('5678');
    expect(stmt.periodStart).toBe('2026-01-18');
    expect(stmt.periodEnd).toBe('2026-02-17');
    expect(stmt.statementDate).toBe('2026-02-17');
    expect(stmt.dueDate).toBe('2026-03-09');
    expect(stmt.previousBalance).toBe(100.0);
    expect(stmt.paymentsCredits).toBe(50.0);
    expect(stmt.purchasesCharges).toBe(64.54);
    expect(stmt.newBalance).toBe(114.54);
    expect(stmt.creditLimit).toBe(5000.0);
    expect(stmt.availableCredit).toBe(4885.46);
    expect(stmt.minPayment).toBe(10.0);
    expect(stmt.cardName).toContain('Scotiabank');
    expect(stmt.cardName).toContain('Visa Infinite');
  });

  it('parses all transactions', () => {
    expect(stmt.transactions).toHaveLength(4);
    const [t1, t2, t3, t4] = stmt.transactions;
    expect(t1).toMatchObject({ ref: '001', transDate: '2026-01-20', postDate: '2026-01-21', amount: 50.25 });
    expect(t1.description).toContain('SOBEYS');
    expect(t2.amount).toBe(-50.0); // trailing "-" marks a credit
    expect(t2.description).toContain('PAYMENT FROM');
    expect(t3.amount).toBe(14.29);
    expect(t3.foreignAmount).toBe(10.0);
    expect(t3.foreignCurrency).toBe('USD');
    expect(t3.description).not.toContain('AMT');
    expect(t4.amount).toBe(8.2);
    expect(t4.transDate).toBe('2026-02-02');
  });

  it('reads subtotals and produces no mismatch warnings', () => {
    expect(stmt.subtotalCredits).toBe(50.0);
    expect(stmt.subtotalDebits).toBe(72.74);
    expect(stmt.warnings).toHaveLength(0);
  });
});

describe('parseScotiaCreditStatement — merged-line layout', () => {
  const stmt = parseScotiaCreditStatement(MERGED_LINES);

  it('parses all transactions', () => {
    expect(stmt.transactions).toHaveLength(4);
    expect(stmt.transactions[0]).toMatchObject({ ref: '001', amount: 50.25, transDate: '2026-01-20' });
    expect(stmt.transactions[1].amount).toBe(-50.0);
    expect(stmt.transactions[2].amount).toBe(14.29);
    expect(stmt.transactions[3].amount).toBe(8.2);
  });

  it('attaches stray AMT lines to the previous transaction', () => {
    expect(stmt.transactions[2].foreignAmount).toBe(10.0);
    expect(stmt.transactions[2].foreignCurrency).toBe('USD');
  });

  it('produces no mismatch warnings', () => {
    expect(stmt.warnings).toHaveLength(0);
  });
});

describe('parseScotiaCreditStatement — fused trailing minus (pdf.js layout)', () => {
  it('treats "80.00-" as a credit and reads fused subtotal lines', () => {
    const lines = [
      'Statement Period Sep 18, 2026 - Oct 17, 2026',
      'Statement Date Oct 17, 2026',
      'Transactions since your last statement',
      'REF.# DATE DATE DETAILS AMOUNT($)',
      '001 Sep 23 Sep 23 PAYMENT FROM - *****01*9586 80.00-',
      '002 Sep 23 Sep 23 PAYMENT FROM - *****01*9586 1,000.00-',
      '003 Oct 17 Oct 17 ANNUAL FEE 110.00',
      'SUB-TOTAL CREDITS - 1234 XXXX XXXX 5678 $1,080.00-',
      'SUB-TOTAL DEBITS - 1234 XXXX XXXX 5678 $110.00',
    ];
    const stmt = parseScotiaCreditStatement(lines);
    expect(stmt.transactions).toHaveLength(3);
    expect(stmt.transactions[0].amount).toBe(-80.0);
    expect(stmt.transactions[1].amount).toBe(-1000.0);
    expect(stmt.transactions[2].amount).toBe(110.0);
    expect(stmt.subtotalCredits).toBe(1080.0);
    expect(stmt.subtotalDebits).toBe(110.0);
    expect(stmt.warnings).toHaveLength(0);
  });
});

describe('parseScotiaCreditStatement — year boundary', () => {
  it('assigns years across Dec/Jan boundary', () => {
    const lines = [
      'Statement Period Dec 18, 2025 - Jan 17, 2026',
      'Statement Date Jan 17, 2026',
      'Transactions since your last statement',
      '001 Dec 20 Dec 21 SOBEYS 4154 ORLEANS ON 10.00',
      '002 Jan 5 Jan 6 TIM HORTONS #7366 ORLEANS ON 5.00',
      'SUB-TOTAL CREDITS - 1234 XXXX XXXX 5678',
      'SUB-TOTAL DEBITS - 1234 XXXX XXXX 5678',
      '$0.00 $15.00',
    ];
    const stmt = parseScotiaCreditStatement(lines);
    expect(stmt.transactions[0].transDate).toBe('2025-12-20');
    expect(stmt.transactions[1].transDate).toBe('2026-01-05');
  });
});

describe('parseScotiaCreditStatement — garbage input', () => {
  it('warns instead of crashing', () => {
    const stmt = parseScotiaCreditStatement(['hello world', 'nothing here']);
    expect(stmt.transactions).toHaveLength(0);
    expect(stmt.warnings.length).toBeGreaterThan(0);
  });
});
