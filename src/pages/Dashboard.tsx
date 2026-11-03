import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '../lib/store';
import {
  balanceSeries,
  categoryByMonth,
  categoryTotals,
  computeKpis,
  monthlySpendSeries,
  topMerchants,
} from '../lib/analytics';
import { fmtCurrency, fmtDate, monthKey, monthLabel } from '../lib/format';
import KpiCard from '../components/KpiCard';
import { CategoryBadge } from '../components/CategorySelect';

const tooltipStyle = {
  backgroundColor: '#16213a',
  border: '1px solid #24304d',
  borderRadius: 8,
  fontSize: '0.85rem',
};

export default function Dashboard() {
  const { data } = useData();
  const { transactions, categories, statements, accounts } = data;

  const months = useMemo(
    () => [...new Set(transactions.map((t) => monthKey(t.transDate)))].sort().reverse(),
    [transactions],
  );
  const [month, setMonth] = useState<string>('all');

  const monthTxns = useMemo(
    () => (month === 'all' ? transactions : transactions.filter((t) => monthKey(t.transDate) === month)),
    [transactions, month],
  );

  const kpis = useMemo(() => computeKpis(transactions, categories, month), [transactions, categories, month]);
  const monthly = useMemo(() => monthlySpendSeries(transactions, categories), [transactions, categories]);
  const catTotals = useMemo(() => categoryTotals(monthTxns, categories), [monthTxns, categories]);
  const merchants = useMemo(() => topMerchants(monthTxns, categories, 10), [monthTxns, categories]);
  const balances = useMemo(() => balanceSeries(statements, accounts), [statements, accounts]);
  const byMonth = useMemo(() => categoryByMonth(transactions, categories), [transactions, categories]);

  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.transDate.localeCompare(a.transDate)).slice(0, 8),
    [transactions],
  );

  const latestBalance = useMemo(() => {
    const withBal = statements.filter((s) => s.newBalance !== undefined);
    if (withBal.length === 0) return undefined;
    return withBal.sort((a, b) => b.statementDate.localeCompare(a.statementDate))[0];
  }, [statements]);

  if (transactions.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h2>Dashboard</h2>
        </div>
        <div className="card empty-state">
          <div className="big">No data yet</div>
          <p>Import a Scotiabank credit card statement (PDF) or account activity CSV to see your dashboard.</p>
          <Link to="/import">
            <button>Go to Import</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <div className="subtitle">
            {transactions.length} transactions · {statements.length} statement{statements.length === 1 ? '' : 's'} imported
          </div>
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label={month === 'all' ? 'Total spend' : `Spend · ${monthLabel(month)}`}
          value={fmtCurrency(kpis.monthSpend)}
          sub={
            kpis.momPct !== null ? (
              <>
                vs {fmtCurrency(kpis.prevMonthSpend)} last month:{' '}
                <span className={kpis.momPct > 0 ? 'up' : 'down'}>
                  {kpis.momPct > 0 ? '▲' : '▼'} {Math.abs(kpis.momPct).toFixed(0)}%
                </span>
              </>
            ) : undefined
          }
        />
        <KpiCard label="Avg monthly spend" value={fmtCurrency(kpis.avgMonthly)} sub={`across ${monthly.length} month${monthly.length === 1 ? '' : 's'}`} />
        <KpiCard
          label="Top category"
          value={kpis.topCategory?.name ?? '—'}
          sub={kpis.topCategory ? `${fmtCurrency(kpis.topCategory.total)} (${kpis.topCategory.pct.toFixed(0)}%)` : undefined}
        />
        <KpiCard
          label="Largest purchase"
          value={kpis.largestTxn ? fmtCurrency(kpis.largestTxn.amount) : '—'}
          sub={kpis.largestTxn ? `${kpis.largestTxn.description.slice(0, 32)} · ${fmtDate(kpis.largestTxn.transDate)}` : undefined}
        />
        {latestBalance && (
          <KpiCard
            label="Card balance"
            value={fmtCurrency(latestBalance.newBalance)}
            sub={`as of ${fmtDate(latestBalance.statementDate)}${latestBalance.availableCredit !== undefined ? ` · ${fmtCurrency(latestBalance.availableCredit)} available` : ''}`}
          />
        )}
        <KpiCard label="Transactions" value={kpis.txnCount} sub={month === 'all' ? 'all time' : monthLabel(month)} />
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3>Monthly spend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#24304d" />
              <XAxis dataKey="label" stroke="#93a0b8" fontSize={12} />
              <YAxis stroke="#93a0b8" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtCurrency(Number(v)), 'Spend']} />
              <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Categories {month !== 'all' ? `· ${monthLabel(month)}` : ''}</h3>
          {catTotals.length === 0 ? (
            <p className="muted">No spending in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={catTotals} dataKey="total" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {catTotals.map((c) => (
                    <Cell key={c.categoryId} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCurrency(Number(v))} />
                <Legend formatter={(v: string) => <span style={{ color: '#e5eaf3', fontSize: '0.8rem' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="chart-grid-3">
        <div className="card">
          <h3>Spending by category over time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={byMonth.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#24304d" />
              <XAxis dataKey="label" stroke="#93a0b8" fontSize={12} />
              <YAxis stroke="#93a0b8" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCurrency(Number(v))} />
              <Legend formatter={(v: string) => <span style={{ color: '#e5eaf3', fontSize: '0.8rem' }}>{byMonth.cats.find((c) => c.id === v)?.name ?? v}</span>} />
              {byMonth.cats.map((c) => (
                <Area key={c.id} type="monotone" dataKey={c.id} name={c.id} stackId="1" stroke={c.color} fill={c.color} fillOpacity={0.55} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Card balance over time</h3>
          {balances.length === 0 ? (
            <p className="muted">Import statements to track your balance.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={balances}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24304d" />
                <XAxis dataKey="label" stroke="#93a0b8" fontSize={12} />
                <YAxis stroke="#93a0b8" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtCurrency(Number(v)), 'Balance']} />
                <Line type="monotone" dataKey="balance" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="chart-grid-3">
        <div className="card">
          <h3>Top merchants {month !== 'all' ? `· ${monthLabel(month)}` : ''}</h3>
          {merchants.length === 0 ? (
            <p className="muted">No spending in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={merchants} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24304d" />
                <XAxis type="number" stroke="#93a0b8" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
                <YAxis type="category" dataKey="display" stroke="#93a0b8" fontSize={11} width={150} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtCurrency(Number(v))} />
                <Bar dataKey="total" fill="#4ade80" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="flex-between">
            <h3 style={{ margin: 0 }}>Recent transactions</h3>
            <Link to="/transactions">
              <button className="secondary small">View all</button>
            </Link>
          </div>
          <div className="table-scroll mt">
            <table className="data-table">
              <tbody>
                {recent.map((t) => {
                  const cat = categories.find((c) => c.id === t.categoryId);
                  return (
                    <tr key={t.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.transDate)}</td>
                      <td>{t.description.length > 42 ? t.description.slice(0, 42) + '…' : t.description}</td>
                      <td><CategoryBadge category={cat} /></td>
                      <td style={{ textAlign: 'right' }} className={t.amount < 0 ? 'amount-neg' : 'amount-pos'}>
                        {t.amount < 0 ? `−${fmtCurrency(-t.amount)}` : fmtCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
