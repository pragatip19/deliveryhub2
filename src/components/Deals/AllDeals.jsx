import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Download, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDeals, upsertDeal, deleteDeal, getProjects } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatDateInput } from '../../lib/workdays';
import { DEAL_STATUS_OPTIONS } from '../../lib/templates';

const COLUMNS = [
  { key: 'deal_name',                  label: 'Deal Name',                    width: 200 },
  { key: 'record_id',                  label: 'Record ID',                    width: 120 },
  { key: 'status',                     label: 'Status',                       width: 160, type: 'select', options: DEAL_STATUS_OPTIONS },
  { key: 'po_date',                    label: 'PO Date',                      width: 110, type: 'date' },
  { key: 'kickoff_date',               label: 'Kickoff Date',                 width: 110, type: 'date' },
  { key: 'go_live_date',               label: 'Go Live Date',                 width: 110, type: 'date' },
  { key: 'sow_completion_date',        label: 'SOW Completion Date',          width: 140, type: 'date' },
  { key: 'target_sow_completion_days', label: 'Target SOW Days',              width: 120, type: 'number' },
  { key: 'actual_onboarding_days',     label: 'Actual Onboarding Days',       width: 140, type: 'number' },
  { key: 'expected_sow_completion_pct',label: 'Expected SOW %',               width: 120, type: 'number', autoCalc: true },
  { key: 'current_sow_completion_pct', label: 'Current SOW %',                width: 120, type: 'number', autoCalc: true },
  { key: 'delta_pct',                  label: 'Expected - Actual (%)',         width: 140, type: 'number', autoCalc: true },
  { key: 'context',                    label: 'Context',                      width: 220 },
  { key: 'critical_next_actions',      label: 'Critical Next Actions',        width: 220 },
];

const STATUS_COLORS = {
  'Ready for Onboarding': 'bg-blue-100 text-blue-700',
  'Under Onboarding':     'bg-yellow-100 text-yellow-700',
  'Live-Under Scaleup':   'bg-green-100 text-green-700',
};

export default function AllDeals() {
  const { isAdmin } = useAuth();
  const [deals, setDeals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey]  = useState(null);
  const [sortDir, setSortDir]  = useState('asc');
  const [filters, setFilters]  = useState({});
  const [visibleCols, setVisibleCols] = useState(COLUMNS.map(c => c.key));
  const [showColMenu, setShowColMenu] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getDeals();
      setDeals(data);
    } catch { toast.error('Failed to load deals'); }
    setLoading(false);
  }

  async function save(deal) {
    try {
      const saved = await upsertDeal(deal);
      setDeals(prev => prev.find(d => d.id === saved.id)
        ? prev.map(d => d.id === saved.id ? saved : d)
        : [...prev, saved]);
    } catch { toast.error('Failed to save'); }
  }

  async function addRow() {
    await save({ deal_name: 'New Deal', status: 'Under Onboarding', sort_order: deals.length });
  }

  async function remove(id) {
    if (!window.confirm('Delete this deal?')) return;
    try {
      await deleteDeal(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // Copy all visible data to clipboard (for pasting into Google Sheets)
  function copyToClipboard() {
    const cols = COLUMNS.filter(c => visibleCols.includes(c.key));
    const header = cols.map(c => c.label).join('\t');
    const rows = displayed.map(d => cols.map(c => d[c.key] ?? '').join('\t'));
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard — paste into Google Sheets'));
  }

  function exportExcel() {
    const cols = COLUMNS.filter(c => visibleCols.includes(c.key));
    const rows = [cols.map(c => c.label), ...displayed.map(d => cols.map(c => d[c.key] ?? ''))];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'all_deals.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const displayed = [...deals]
    .filter(d => Object.entries(filters).every(([k, v]) =>
      !v || String(d[k] || '').toLowerCase().includes(v.toLowerCase())
    ))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a[sortKey] ?? ''; const vb = b[sortKey] ?? '';
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  const visibleColumns = COLUMNS.filter(c => visibleCols.includes(c.key));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">All Deals</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Fields marked <span className="text-blue-500">auto</span> are synced from project health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={copyToClipboard} className="text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
            Copy
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          {isAdmin() && (
            <button onClick={addRow} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-3.5 h-3.5" /> Add Deal
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 w-8">#</th>
                {visibleColumns.map(col => (
                  <th key={col.key} style={{ minWidth: col.width }} className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-gray-900">
                        {col.label}
                        {col.autoCalc && <span className="text-blue-400 text-xs">(auto)</span>}
                        {sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                      </button>
                    </div>
                    <input
                      placeholder="Filter..." value={filters[col.key] || ''}
                      onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-400"
                    />
                  </th>
                ))}
                {isAdmin() && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {displayed.map((deal, i) => (
                <tr key={deal.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                  {visibleColumns.map(col => (
                    <td key={col.key} className="px-3 py-2" style={{ minWidth: col.width }}>
                      {col.autoCalc ? (
                        <span className={`text-sm font-medium ${col.key === 'delta_pct' && (deal[col.key] ?? 0) < -5 ? 'text-red-600' : 'text-gray-700'}`}>
                          {deal[col.key] != null ? `${Number(deal[col.key]).toFixed(1)}%` : '—'}
                        </span>
                      ) : col.type === 'select' ? (
                        <select
                          disabled={!isAdmin()}
                          value={deal[col.key] || ''}
                          onChange={e => save({ ...deal, [col.key]: e.target.value })}
                          className="border-0 bg-transparent text-sm w-full focus:outline-none"
                        >
                          {col.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : col.type === 'date' ? (
                        isAdmin() ? (
                          <input type="date" value={formatDateInput(deal[col.key]) || ''} onChange={e => save({ ...deal, [col.key]: e.target.value || null })}
                            className="border-0 bg-transparent text-sm w-full focus:outline-none" />
                        ) : <span className="text-sm text-gray-700">{formatDate(deal[col.key]) || '—'}</span>
                      ) : col.type === 'number' ? (
                        isAdmin() ? (
                          <input type="number" value={deal[col.key] ?? ''} onChange={e => save({ ...deal, [col.key]: e.target.value ? Number(e.target.value) : null })}
                            className="border-0 bg-transparent text-sm w-full focus:outline-none" />
                        ) : <span className="text-sm text-gray-700">{deal[col.key] ?? '—'}</span>
                      ) : (
                        isAdmin() ? (
                          <InlineEdit value={deal[col.key] || ''} onSave={v => save({ ...deal, [col.key]: v })} />
                        ) : <span className="text-sm text-gray-700">{deal[col.key] || '—'}</span>
                      )}
                    </td>
                  ))}
                  {isAdmin() && (
                    <td className="px-2 py-2">
                      <button onClick={() => remove(deal.id)} className="text-gray-300 hover:text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={visibleColumns.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">No deals found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InlineEdit({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  function commit() { setEditing(false); if (val !== value) onSave(val); }
  if (editing) return (
    <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
      className="w-full border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none" />
  );
  return (
    <span onClick={() => setEditing(true)} className="block cursor-text hover:bg-blue-50 rounded px-1 py-0.5 transition min-h-[1.5rem] text-gray-700">
      {value || <span className="text-gray-300 italic">—</span>}
    </span>
  );
}
