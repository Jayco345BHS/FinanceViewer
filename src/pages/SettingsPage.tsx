import { useRef, useState } from 'react';
import { useData } from '../lib/store';

export default function SettingsPage() {
  const { data, addRule, deleteRule, addCategory, deleteCategory, renameAccount, recategorizeAll, exportBackup, importBackup, clearAll } = useData();
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleCategory, setRuleCategory] = useState(data.categories[0]?.id ?? 'other');
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#38bdf8');
  const [message, setMessage] = useState('');
  const backupInput = useRef<HTMLInputElement>(null);

  const downloadBackup = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeviewer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <div className="subtitle">Accounts, categories, rules, and data management.</div>
        </div>
      </div>

      {message && <div className="alert ok">{message}</div>}

      <div className="settings-grid">
        <div className="card">
          <h3>Accounts</h3>
          {data.accounts.length === 0 ? (
            <p className="muted">No accounts yet — they are created automatically when you import.</p>
          ) : (
            data.accounts.map((a) => (
              <div className="rule-row" key={a.id}>
                <span style={{ minWidth: 70 }} className="muted">
                  {a.type === 'credit' ? '💳 Credit' : '🏦 Debit'}
                </span>
                <input
                  type="text"
                  defaultValue={a.label}
                  style={{ flex: 1 }}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== a.label) void renameAccount(a.id, e.target.value.trim());
                  }}
                />
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Categories</h3>
          <div className="rules-list mb">
            {data.categories.map((c) => (
              <div className="rule-row" key={c.id}>
                <span className="cat-badge" style={{ background: c.color }}>
                  {c.name}
                </span>
                <span style={{ flex: 1 }} className="muted">
                  {c.isTransfer ? 'excluded from spending' : ''}
                </span>
                {!['other', 'transfers', 'income'].includes(c.id) && (
                  <button
                    className="danger small"
                    onClick={() => {
                      if (window.confirm(`Delete category "${c.name}"? Its transactions become "Other".`)) void deleteCategory(c.id);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="filters-row">
            <input type="text" placeholder="New category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
            <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--bg-soft)' }} />
            <button
              className="secondary"
              onClick={() => {
                const name = catName.trim();
                if (!name) return;
                const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (data.categories.some((c) => c.id === id)) {
                  setMessage(`Category "${name}" already exists.`);
                  return;
                }
                void addCategory({ id, name, color: catColor });
                setCatName('');
                setMessage(`Added category "${name}".`);
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Categorization rules</h3>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Descriptions containing a keyword are auto-assigned its category. First match wins. Changes apply to future imports; use re-apply to update existing transactions (manual edits are kept).
          </p>
          <div className="rules-list mb">
            {data.rules.map((r, i) => {
              const cat = data.categories.find((c) => c.id === r.categoryId);
              return (
                <div className="rule-row" key={`${r.keyword}-${i}`}>
                  <code>{r.keyword}</code>
                  <span className="cat-badge" style={{ background: cat?.color ?? '#9ca3af' }}>
                    {cat?.name ?? r.categoryId}
                  </span>
                  <button className="danger small" onClick={() => void deleteRule(i)}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <div className="filters-row">
            <input type="text" placeholder="Keyword (e.g. COSTCO)" value={ruleKeyword} onChange={(e) => setRuleKeyword(e.target.value)} />
            <select value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)}>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={() => {
                const kw = ruleKeyword.trim();
                if (!kw) return;
                void addRule({ keyword: kw.toUpperCase(), categoryId: ruleCategory });
                setRuleKeyword('');
                setMessage(`Added rule "${kw.toUpperCase()}".`);
              }}
            >
              Add rule
            </button>
            <button
              onClick={() => {
                void recategorizeAll().then((n) => setMessage(`Re-applied rules — ${n} transaction${n === 1 ? '' : 's'} updated.`));
              }}
            >
              Re-apply rules to all
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Backup &amp; data</h3>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Everything is stored locally in your browser (IndexedDB). Export a JSON backup to move data between devices or keep it safe.
          </p>
          <div className="filters-row">
            <button onClick={downloadBackup}>Export backup (JSON)</button>
            <button className="secondary" onClick={() => backupInput.current?.click()}>
              Restore backup…
            </button>
            <input
              ref={backupInput}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                f.text()
                  .then((txt) => importBackup(txt))
                  .then(() => setMessage('Backup restored.'))
                  .catch((err: unknown) => setMessage(`Restore failed: ${err instanceof Error ? err.message : String(err)}`));
                e.target.value = '';
              }}
            />
            <button
              className="danger"
              onClick={() => {
                if (window.confirm('Delete ALL data (transactions, statements, accounts, custom rules)? This cannot be undone.')) {
                  void clearAll().then(() => setMessage('All data cleared.'));
                }
              }}
            >
              Clear all data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
