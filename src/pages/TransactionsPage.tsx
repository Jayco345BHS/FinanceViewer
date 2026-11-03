import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { fmtCurrency, fmtDate, monthKey, monthLabel } from '../lib/format';
import CategorySelect from '../components/CategorySelect';

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const { data, setTransactionCategory } = useData();
  const { transactions, categories, accounts } = data;

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [month, setMonth] = useState('all');
  const [page, setPage] = useState(0);

  const months = useMemo(
    () => [...new Set(transactions.map((t) => monthKey(t.transDate)))].sort().reverse(),
    [transactions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => (month === 'all' ? true : monthKey(t.transDate) === month))
      .filter((t) => (categoryId === 'all' ? true : t.categoryId === categoryId))
      .filter((t) => (accountId === 'all' ? true : t.accountId === accountId))
      .filter((t) => (q ? t.description.toLowerCase().includes(q) : true))
      .sort((a, b) => b.transDate.localeCompare(a.transDate));
  }, [transactions, search, categoryId, accountId, month]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const resetPage = () => setPage(0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Transactions</h2>
          <div className="subtitle">
            {filtered.length} of {transactions.length} shown · net {fmtCurrency(total)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="filters-row">
          <input
            type="search"
            placeholder="Search descriptions…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            style={{ minWidth: 220 }}
          />
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Account</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <tr key={t.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(t.transDate)}
                  </td>
                  <td>
                    {t.description}
                    {t.foreignAmount !== undefined && (
                      <span className="muted">
                        {' '}
                        ({t.foreignAmount} {t.foreignCurrency})
                      </span>
                    )}
                  </td>
                  <td className="muted">{accounts.find((a) => a.id === t.accountId)?.label ?? t.accountId}</td>
                  <td>
                    <CategorySelect categories={categories} value={t.categoryId} onChange={(v) => void setTransactionCategory(t.id, v)} />
                  </td>
                  <td style={{ textAlign: 'right' }} className={t.amount < 0 ? 'amount-neg' : 'amount-pos'}>
                    {t.amount < 0 ? `−${fmtCurrency(-t.amount)}` : fmtCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="secondary small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button className="secondary small" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
