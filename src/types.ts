export interface Transaction {
  id: string;
  accountId: string;
  source: 'pdf-cc' | 'csv';
  /** ISO yyyy-mm-dd */
  transDate: string;
  /** ISO yyyy-mm-dd */
  postDate: string;
  description: string;
  /** Positive = money spent (charge/debit), negative = money in (payment/credit/refund). */
  amount: number;
  foreignAmount?: number;
  foreignCurrency?: string;
  categoryId: string;
  categoryOverridden: boolean;
  ref?: string;
  statementKey?: string;
}

export interface StatementMeta {
  /** accountId + '|' + statementDate */
  key: string;
  accountId: string;
  fileName: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
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
  transactionCount: number;
  importedAt: string;
  cardName?: string;
}

export interface Account {
  id: string;
  label: string;
  type: 'credit' | 'debit';
  last4?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Transfers/payments are excluded from spending analytics. */
  isTransfer?: boolean;
}

export interface CategoryRule {
  keyword: string;
  categoryId: string;
}

export interface AppData {
  transactions: Transaction[];
  statements: StatementMeta[];
  accounts: Account[];
  categories: Category[];
  rules: CategoryRule[];
}
