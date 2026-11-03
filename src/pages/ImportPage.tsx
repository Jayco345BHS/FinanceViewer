import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useData } from '../lib/store';
import { extractLinesFromPdf } from '../lib/pdf/extract';
import { parseScotiaCreditStatement } from '../lib/pdf/scotiaCredit';
import type { ParsedStatement } from '../lib/pdf/scotiaCredit';
import { DEFAULT_MAPPING, guessMapping, parseCsv, parseCsvRaw } from '../lib/csv';
import type { CsvMapping, ParsedCsvRow } from '../lib/csv';
import { fmtCurrency, fmtDate } from '../lib/format';

interface StagedPdf {
  kind: 'pdf';
  fileName: string;
  parsed: ParsedStatement;
}

interface StagedCsv {
  kind: 'csv';
  fileName: string;
  rows: ParsedCsvRow[];
  errors: string[];
}

type Staged = StagedPdf | StagedCsv;

export default function ImportPage() {
  const { data, importStatement, importCsvRows, deleteStatement, addAccount } = useData();
  const [staged, setStaged] = useState<Staged[]>([]);
  const [processing, setProcessing] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string }[]>([]);
  const [dragover, setDragover] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // CSV mapping state
  const [csvFile, setCsvFile] = useState<{ name: string; text: string } | null>(null);
  const [csvGrid, setCsvGrid] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CsvMapping>(DEFAULT_MAPPING);
  const [csvAccountId, setCsvAccountId] = useState<string>('');
  const [newAccountLabel, setNewAccountLabel] = useState('');

  const pushMessage = useCallback((kind: 'ok' | 'warn' | 'error', text: string) => {
    setMessages((m) => [...m, { kind, text }]);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const name = file.name;
        if (/\.pdf$/i.test(name)) {
          setProcessing((p) => [...p, name]);
          try {
            const buf = await file.arrayBuffer();
            const lines = await extractLinesFromPdf(buf);
            const parsed = parseScotiaCreditStatement(lines);
            setStaged((s) => [...s, { kind: 'pdf', fileName: name, parsed }]);
          } catch (err) {
            pushMessage('error', `${name}: failed to read PDF — ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            setProcessing((p) => p.filter((n) => n !== name));
          }
        } else if (/\.(csv|txt)$/i.test(name)) {
          const text = await file.text();
          const grid = parseCsvRaw(text);
          if (grid.length === 0) {
            pushMessage('error', `${name}: no rows found.`);
            continue;
          }
          const firstRowLooksLikeHeader = grid[0].some((c) => /[a-zA-Z]/.test(c)) && !/^\d/.test(grid[0][0] ?? '');
          const guessed = guessMapping(firstRowLooksLikeHeader ? grid[0] : []);
          guessed.hasHeader = firstRowLooksLikeHeader;
          setCsvFile({ name, text });
          setCsvGrid(grid);
          setMapping(guessed);
          const firstDebit = data.accounts.find((a) => a.type === 'debit');
          setCsvAccountId((prev) => prev || firstDebit?.id || 'new');
        } else {
          pushMessage('warn', `${name}: unsupported file type. Drop a PDF statement or CSV export.`);
        }
      }
    },
    [data.accounts, pushMessage],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragover(false);
      if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const commitPdf = useCallback(
    async (item: StagedPdf) => {
      const res = await importStatement(item.parsed, item.fileName);
      if (res.duplicateStatement) {
        pushMessage('warn', `${item.fileName}: statement already imported — skipped.`);
      } else {
        pushMessage('ok', `${item.fileName}: imported ${res.added} transaction${res.added === 1 ? '' : 's'}${res.skipped ? ` (${res.skipped} duplicates skipped)` : ''}.`);
      }
      setStaged((s) => s.filter((x) => x !== item));
    },
    [importStatement, pushMessage],
  );

  const stageCsv = useCallback(() => {
    if (!csvFile) return;
    const res = parseCsv(csvFile.text, mapping);
    if (res.rows.length === 0) {
      pushMessage('error', `${csvFile.name}: no valid rows with the current column mapping.`);
      return;
    }
    setStaged((s) => [...s, { kind: 'csv', fileName: csvFile.name, rows: res.rows, errors: res.errors }]);
    setCsvFile(null);
    setCsvGrid([]);
  }, [csvFile, mapping, pushMessage]);

  const commitCsv = useCallback(
    async (item: StagedCsv) => {
      let accountId = csvAccountId;
      if (accountId === 'new') {
        const label = newAccountLabel.trim() || 'Chequing account';
        accountId = `debit-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
        await addAccount({ id: accountId, label, type: 'debit' });
      }
      const res = await importCsvRows(item.rows, accountId, item.fileName);
      pushMessage('ok', `${item.fileName}: imported ${res.added} transaction${res.added === 1 ? '' : 's'}${res.skipped ? ` (${res.skipped} duplicates skipped)` : ''}.`);
      setStaged((s) => s.filter((x) => x !== item));
    },
    [csvAccountId, newAccountLabel, addAccount, importCsvRows, pushMessage],
  );

  const debitAccounts = data.accounts.filter((a) => a.type === 'debit');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Import</h2>
          <div className="subtitle">Upload Scotiabank credit card statements (PDF) or account activity exports (CSV). Files are parsed locally in your browser.</div>
        </div>
      </div>

      <div
        className={dragover ? 'dropzone dragover' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
      >
        <div className="big">Drop statements here</div>
        <p>or click to browse — PDF credit card statements, CSV account exports. You can drop multiple files at once.</p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".pdf,.csv,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {processing.map((n) => (
        <div className="alert ok" key={n}>
          <span className="spinner" style={{ display: 'inline-block', width: 14, height: 14, borderWidth: 2, verticalAlign: 'middle', marginRight: 8 }} />
          Parsing {n}…
        </div>
      ))}

      {messages.map((m, i) => (
        <div key={i} className={`alert ${m.kind}`}>
          {m.text}
        </div>
      ))}

      {csvFile && (
        <div className="card staged-card">
          <h3>CSV column mapping — {csvFile.name}</h3>
          <div className="filters-row">
            <label>
              Date column{' '}
              <ColumnSelect grid={csvGrid} value={mapping.date} onChange={(v) => setMapping({ ...mapping, date: v })} />
            </label>
            <label>
              Description column{' '}
              <ColumnSelect grid={csvGrid} value={mapping.description} onChange={(v) => setMapping({ ...mapping, description: v })} />
            </label>
            <label>
              Amount column{' '}
              <ColumnSelect grid={csvGrid} value={mapping.amount} allowNone onChange={(v) => setMapping({ ...mapping, amount: v, debit: v >= 0 ? -1 : mapping.debit, credit: v >= 0 ? -1 : mapping.credit })} />
            </label>
            {mapping.amount < 0 && (
              <>
                <label>
                  Debit (money out){' '}
                  <ColumnSelect grid={csvGrid} value={mapping.debit} allowNone onChange={(v) => setMapping({ ...mapping, debit: v })} />
                </label>
                <label>
                  Credit (money in){' '}
                  <ColumnSelect grid={csvGrid} value={mapping.credit} allowNone onChange={(v) => setMapping({ ...mapping, credit: v })} />
                </label>
              </>
            )}
            <label>
              Date format{' '}
              <select value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value as CsvMapping['dateFormat'] })}>
                <option value="auto">Auto</option>
                <option value="ymd">yyyy-mm-dd</option>
                <option value="mdy">mm/dd/yyyy</option>
                <option value="dmy">dd/mm/yyyy</option>
              </select>
            </label>
            <label>
              Sign convention{' '}
              <select value={mapping.sign} onChange={(e) => setMapping({ ...mapping, sign: e.target.value as CsvMapping['sign'] })}>
                <option value="invert">Bank style (money out is negative)</option>
                <option value="normal">Money out is positive</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={mapping.hasHeader} onChange={(e) => setMapping({ ...mapping, hasHeader: e.target.checked })} /> First row is a header
            </label>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <tbody>
                {csvGrid.slice(0, 4).map((row, i) => (
                  <tr key={i}>
                    {row.map((c, j) => (
                      <td key={j} className="muted">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt">
            <button onClick={stageCsv}>Preview import</button>
            <button className="secondary" style={{ marginLeft: 8 }} onClick={() => { setCsvFile(null); setCsvGrid([]); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {staged.map((item, idx) => (
        <div className="card staged-card" key={idx}>
          {item.kind === 'pdf' ? (
            <PdfPreview item={item} onCommit={() => void commitPdf(item)} onDiscard={() => setStaged((s) => s.filter((x) => x !== item))} />
          ) : (
            <div>
              <div className="flex-between">
                <h3 style={{ margin: 0 }}>{item.fileName}</h3>
                <div>
                  <button onClick={() => void commitCsv(item)}>Import {item.rows.length} rows</button>
                  <button className="secondary" style={{ marginLeft: 8 }} onClick={() => setStaged((s) => s.filter((x) => x !== item))}>
                    Discard
                  </button>
                </div>
              </div>
              <div className="filters-row mt">
                <label>
                  Import into account{' '}
                  <select value={csvAccountId} onChange={(e) => setCsvAccountId(e.target.value)}>
                    {debitAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                    <option value="new">+ New account…</option>
                  </select>
                </label>
                {csvAccountId === 'new' && (
                  <input type="text" placeholder="Account name (e.g. Scotia Chequing)" value={newAccountLabel} onChange={(e) => setNewAccountLabel(e.target.value)} />
                )}
              </div>
              {item.errors.length > 0 && (
                <div className="alert warn">
                  {item.errors.length} row{item.errors.length === 1 ? '' : 's'} skipped: {item.errors.slice(0, 3).join('; ')}
                  {item.errors.length > 3 ? '…' : ''}
                </div>
              )}
              <CsvPreview rows={item.rows} />
            </div>
          )}
        </div>
      ))}

      <div className="card mt">
        <h3>Imported statements</h3>
        {data.statements.length === 0 ? (
          <p className="muted">Nothing imported yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Account</th>
                  <th>Period</th>
                  <th>Transactions</th>
                  <th>New balance</th>
                  <th>Imported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...data.statements]
                  .sort((a, b) => b.statementDate.localeCompare(a.statementDate))
                  .map((s) => (
                    <tr key={s.key}>
                      <td>{s.fileName}</td>
                      <td className="muted">{data.accounts.find((a) => a.id === s.accountId)?.label ?? s.accountId}</td>
                      <td className="muted">
                        {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                      </td>
                      <td>{s.transactionCount}</td>
                      <td>{fmtCurrency(s.newBalance)}</td>
                      <td className="muted">{fmtDate(s.importedAt.slice(0, 10))}</td>
                      <td>
                        <button
                          className="danger small"
                          onClick={() => {
                            if (window.confirm(`Delete this statement and its ${s.transactionCount} transactions?`)) {
                              void deleteStatement(s.key);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnSelect({ grid, value, onChange, allowNone }: { grid: string[][]; value: number; onChange: (v: number) => void; allowNone?: boolean }) {
  const cols = grid[0]?.length ?? 0;
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {allowNone && <option value={-1}>—</option>}
      {Array.from({ length: cols }, (_, i) => (
        <option key={i} value={i}>
          Column {i + 1} ({grid[0]?.[i]?.slice(0, 16) || '…'})
        </option>
      ))}
    </select>
  );
}

function PdfPreview({ item, onCommit, onDiscard }: { item: StagedPdf; onCommit: () => void; onDiscard: () => void }) {
  const p = item.parsed;
  const credits = p.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + -t.amount, 0);
  const debits = p.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  return (
    <div>
      <div className="flex-between">
        <h3 style={{ margin: 0 }}>{item.fileName}</h3>
        <div>
          <button onClick={onCommit} disabled={p.transactions.length === 0}>
            Import {p.transactions.length} transactions
          </button>
          <button className="secondary" style={{ marginLeft: 8 }} onClick={onDiscard}>
            Discard
          </button>
        </div>
      </div>
      {p.warnings.map((w, i) => (
        <div className="alert warn" key={i}>
          ⚠ {w}
        </div>
      ))}
      <div className="staged-summary mt">
        <Field label="Card" value={p.cardName ?? '—'} />
        <Field label="Account" value={p.accountLast4 ? `•••• ${p.accountLast4}` : '—'} />
        <Field label="Period" value={p.periodStart && p.periodEnd ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : '—'} />
        <Field label="Purchases" value={fmtCurrency(debits)} />
        <Field label="Payments" value={fmtCurrency(credits)} />
        <Field label="New balance" value={fmtCurrency(p.newBalance)} />
        <Field label="Due" value={`${fmtCurrency(p.minPayment)} by ${fmtDate(p.dueDate)}`} />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {p.transactions.slice(0, 12).map((t) => (
              <tr key={t.ref}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.transDate)}</td>
                <td>
                  {t.description}
                  {t.foreignAmount !== undefined && (
                    <span className="muted"> ({t.foreignAmount} {t.foreignCurrency})</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className={t.amount < 0 ? 'amount-neg' : 'amount-pos'}>
                  {t.amount < 0 ? `−${fmtCurrency(-t.amount)}` : fmtCurrency(t.amount)}
                </td>
              </tr>
            ))}
            {p.transactions.length > 12 && (
              <tr>
                <td colSpan={3} className="muted">
                  … and {p.transactions.length - 12} more
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CsvPreview({ rows }: { rows: ParsedCsvRow[] }) {
  return (
    <div className="table-scroll mt">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r, i) => (
            <tr key={i}>
              <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
              <td>{r.description}</td>
              <td style={{ textAlign: 'right' }} className={r.amount < 0 ? 'amount-neg' : 'amount-pos'}>
                {r.amount < 0 ? `−${fmtCurrency(-r.amount)}` : fmtCurrency(r.amount)}
              </td>
            </tr>
          ))}
          {rows.length > 12 && (
            <tr>
              <td colSpan={3} className="muted">
                … and {rows.length - 12} more
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
