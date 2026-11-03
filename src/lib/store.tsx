/**
 * Local persistence backed by IndexedDB (via localforage) with a React
 * context on top. All data stays on the user's machine.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import localforage from 'localforage';
import type { Account, AppData, Category, CategoryRule, StatementMeta, Transaction } from '../types';
import type { ParsedStatement } from './pdf/scotiaCredit';
import type { ParsedCsvRow } from './csv';
import { categorize, DEFAULT_CATEGORIES, DEFAULT_RULES } from './categorize';

const db = localforage.createInstance({ name: 'financeviewer', storeName: 'data' });

const KEYS = {
  transactions: 'fv:transactions',
  statements: 'fv:statements',
  accounts: 'fv:accounts',
  categories: 'fv:categories',
  rules: 'fv:rules',
} as const;

const BACKUP_VERSION = 1;

function hashId(input: string): string {
  // djb2 x2 for a stable, collision-resistant-enough local id.
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 33) ^ c;
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

export interface ImportResult {
  statementKey: string;
  added: number;
  skipped: number;
  duplicateStatement: boolean;
  warnings: string[];
}

interface DataContextValue {
  ready: boolean;
  data: AppData;
  importStatement: (parsed: ParsedStatement, fileName: string) => Promise<ImportResult>;
  importCsvRows: (rows: ParsedCsvRow[], accountId: string, fileName: string) => Promise<ImportResult>;
  deleteStatement: (key: string) => Promise<void>;
  setTransactionCategory: (id: string, categoryId: string) => Promise<void>;
  recategorizeAll: () => Promise<number>;
  addRule: (rule: CategoryRule) => Promise<void>;
  deleteRule: (index: number) => Promise<void>;
  addCategory: (cat: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  renameAccount: (id: string, label: string) => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  exportBackup: () => string;
  importBackup: (json: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

async function loadAll(): Promise<AppData> {
  const [transactions, statements, accounts, categories, rules] = await Promise.all([
    db.getItem<Transaction[]>(KEYS.transactions),
    db.getItem<StatementMeta[]>(KEYS.statements),
    db.getItem<Account[]>(KEYS.accounts),
    db.getItem<Category[]>(KEYS.categories),
    db.getItem<CategoryRule[]>(KEYS.rules),
  ]);
  return {
    transactions: transactions ?? [],
    statements: statements ?? [],
    accounts: accounts ?? [],
    categories: categories ?? DEFAULT_CATEGORIES,
    rules: rules ?? DEFAULT_RULES,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>({
    transactions: [],
    statements: [],
    accounts: [],
    categories: DEFAULT_CATEGORIES,
    rules: DEFAULT_RULES,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadAll().then((d) => {
      setData(d);
      setReady(true);
    });
  }, []);

  const persist = useCallback(async (next: AppData) => {
    setData(next);
    await Promise.all([
      db.setItem(KEYS.transactions, next.transactions),
      db.setItem(KEYS.statements, next.statements),
      db.setItem(KEYS.accounts, next.accounts),
      db.setItem(KEYS.categories, next.categories),
      db.setItem(KEYS.rules, next.rules),
    ]);
  }, []);

  const importStatement = useCallback(
    async (parsed: ParsedStatement, fileName: string): Promise<ImportResult> => {
      const last4 = parsed.accountLast4 ?? 'unknown';
      const accountId = `cc-${last4}`;
      const statementDate = parsed.statementDate ?? parsed.periodEnd ?? 'unknown';
      const statementKey = `${accountId}|${statementDate}`;

      if (data.statements.some((s) => s.key === statementKey)) {
        return { statementKey, added: 0, skipped: parsed.transactions.length, duplicateStatement: true, warnings: parsed.warnings };
      }

      const accounts = [...data.accounts];
      if (!accounts.some((a) => a.id === accountId)) {
        accounts.push({
          id: accountId,
          label: parsed.cardName ? `${parsed.cardName} •••• ${last4}` : `Credit card •••• ${last4}`,
          type: 'credit',
          last4,
        });
      }

      const existing = new Set(data.transactions.map((t) => t.id));
      const batchSeen = new Set<string>();
      const newTxns: Transaction[] = [];
      let skipped = 0;
      for (const t of parsed.transactions) {
        let id = hashId(`${accountId}|${t.ref}|${t.transDate}|${t.postDate}|${t.description}|${t.amount.toFixed(2)}`);
        let n = 2;
        while (batchSeen.has(id)) id = hashId(`${accountId}|${t.ref}|${t.transDate}|${t.postDate}|${t.description}|${t.amount.toFixed(2)}#${n++}`);
        batchSeen.add(id);
        if (existing.has(id)) {
          skipped++;
          continue;
        }
        newTxns.push({
          id,
          accountId,
          source: 'pdf-cc',
          transDate: t.transDate,
          postDate: t.postDate,
          description: t.description,
          amount: t.amount,
          foreignAmount: t.foreignAmount,
          foreignCurrency: t.foreignCurrency,
          categoryId: categorize(t.description, data.rules),
          categoryOverridden: false,
          ref: t.ref,
          statementKey,
        });
      }

      const meta: StatementMeta = {
        key: statementKey,
        accountId,
        fileName,
        statementDate,
        periodStart: parsed.periodStart ?? '',
        periodEnd: parsed.periodEnd ?? '',
        previousBalance: parsed.previousBalance,
        paymentsCredits: parsed.paymentsCredits,
        purchasesCharges: parsed.purchasesCharges,
        interestCharged: parsed.interestCharged,
        newBalance: parsed.newBalance,
        creditLimit: parsed.creditLimit,
        availableCredit: parsed.availableCredit,
        minPayment: parsed.minPayment,
        dueDate: parsed.dueDate,
        subtotalCredits: parsed.subtotalCredits,
        subtotalDebits: parsed.subtotalDebits,
        transactionCount: newTxns.length,
        importedAt: new Date().toISOString(),
        cardName: parsed.cardName,
      };

      await persist({
        ...data,
        accounts,
        transactions: [...data.transactions, ...newTxns],
        statements: [...data.statements, meta],
      });
      return { statementKey, added: newTxns.length, skipped, duplicateStatement: false, warnings: parsed.warnings };
    },
    [data, persist],
  );

  const importCsvRows = useCallback(
    async (rows: ParsedCsvRow[], accountId: string, fileName: string): Promise<ImportResult> => {
      const statementKey = `csv|${accountId}|${fileName}`;
      const existing = new Set(data.transactions.map((t) => t.id));
      const batchSeen = new Set<string>();
      const newTxns: Transaction[] = [];
      let skipped = 0;
      for (const r of rows) {
        let id = hashId(`${accountId}|csv|${r.date}|${r.description}|${r.amount.toFixed(2)}`);
        let n = 2;
        while (batchSeen.has(id)) id = hashId(`${accountId}|csv|${r.date}|${r.description}|${r.amount.toFixed(2)}#${n++}`);
        batchSeen.add(id);
        if (existing.has(id)) {
          skipped++;
          continue;
        }
        newTxns.push({
          id,
          accountId,
          source: 'csv',
          transDate: r.date,
          postDate: r.date,
          description: r.description,
          amount: r.amount,
          categoryId: categorize(r.description, data.rules),
          categoryOverridden: false,
          statementKey,
        });
      }
      await persist({ ...data, transactions: [...data.transactions, ...newTxns] });
      return { statementKey, added: newTxns.length, skipped, duplicateStatement: false, warnings: [] };
    },
    [data, persist],
  );

  const deleteStatement = useCallback(
    async (key: string) => {
      await persist({
        ...data,
        statements: data.statements.filter((s) => s.key !== key),
        transactions: data.transactions.filter((t) => t.statementKey !== key),
      });
    },
    [data, persist],
  );

  const setTransactionCategory = useCallback(
    async (id: string, categoryId: string) => {
      await persist({
        ...data,
        transactions: data.transactions.map((t) =>
          t.id === id ? { ...t, categoryId, categoryOverridden: true } : t,
        ),
      });
    },
    [data, persist],
  );

  const recategorizeAll = useCallback(async () => {
    let changed = 0;
    const transactions = data.transactions.map((t) => {
      if (t.categoryOverridden) return t;
      const categoryId = categorize(t.description, data.rules);
      if (categoryId !== t.categoryId) changed++;
      return { ...t, categoryId };
    });
    await persist({ ...data, transactions });
    return changed;
  }, [data, persist]);

  const addRule = useCallback(
    async (rule: CategoryRule) => persist({ ...data, rules: [...data.rules, rule] }),
    [data, persist],
  );

  const deleteRule = useCallback(
    async (index: number) => persist({ ...data, rules: data.rules.filter((_, i) => i !== index) }),
    [data, persist],
  );

  const addCategory = useCallback(
    async (cat: Category) => persist({ ...data, categories: [...data.categories, cat] }),
    [data, persist],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await persist({
        ...data,
        categories: data.categories.filter((c) => c.id !== id),
        transactions: data.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: 'other' } : t)),
        rules: data.rules.filter((r) => r.categoryId !== id),
      });
    },
    [data, persist],
  );

  const renameAccount = useCallback(
    async (id: string, label: string) => {
      await persist({
        ...data,
        accounts: data.accounts.map((a) => (a.id === id ? { ...a, label } : a)),
      });
    },
    [data, persist],
  );

  const addAccount = useCallback(
    async (account: Account) => {
      if (data.accounts.some((a) => a.id === account.id)) return;
      await persist({ ...data, accounts: [...data.accounts, account] });
    },
    [data, persist],
  );

  const exportBackup = useCallback(() => {
    return JSON.stringify({ app: 'financeviewer', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...data }, null, 2);
  }, [data]);

  const importBackup = useCallback(
    async (json: string) => {
      const parsed = JSON.parse(json) as Partial<AppData> & { app?: string };
      if (parsed.app !== 'financeviewer' || !Array.isArray(parsed.transactions)) {
        throw new Error('Not a valid FinanceViewer backup file.');
      }
      await persist({
        transactions: parsed.transactions ?? [],
        statements: parsed.statements ?? [],
        accounts: parsed.accounts ?? [],
        categories: parsed.categories ?? DEFAULT_CATEGORIES,
        rules: parsed.rules ?? DEFAULT_RULES,
      });
    },
    [persist],
  );

  const clearAll = useCallback(async () => {
    await persist({
      transactions: [],
      statements: [],
      accounts: [],
      categories: DEFAULT_CATEGORIES,
      rules: DEFAULT_RULES,
    });
  }, [persist]);

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      data,
      importStatement,
      importCsvRows,
      deleteStatement,
      setTransactionCategory,
      recategorizeAll,
      addRule,
      deleteRule,
      addCategory,
      deleteCategory,
      renameAccount,
      addAccount,
      exportBackup,
      importBackup,
      clearAll,
    }),
    [ready, data, importStatement, importCsvRows, deleteStatement, setTransactionCategory, recategorizeAll, addRule, deleteRule, addCategory, deleteCategory, renameAccount, addAccount, exportBackup, importBackup, clearAll],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
