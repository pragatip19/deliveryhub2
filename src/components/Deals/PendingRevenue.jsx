import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Settings, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAllPayments, getPendingRevenueColumns, upsertPendingRevenueColumn,
  deletePendingRevenueColumn, getPendingRevenueCells, upsertPendingRevenueCell
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatDateInput } from '../../lib/workdays';

// Base fixed columns (from payment data)
const BASE_COLUMNS = [
  { key: 'project_name',   label: 'Deal Name',         width: 200 },
  { key: 'go_live_date',   label: 'Go Live Date',       width: 110, type: 'date' },
  { key: 'dm_name',        label: 'Delivery Manager',   width: 150 },
  { key: 'category_name',  label: 'Application',        width: 120 },
  { key: 'project_link',   label: 'Project Link',       width: 140, type: 'link' },
  { key: 'line_item',      label: 'Line Item',          width: 180 },
  { key: 'type',           label: 'Type',               width: 140 },
  { key: 'currency',       label: 'Currency',           width: 80 },
  { key: 'amount',         label: 'Amount',             width: 110, type: 'number' },
  { key: 'milestone_name', label: 'Payment Milestone',  width: 180 },
  { key: 'planned_milestone_completion_date', label: 'Planned Milestone Date', width: 160, type: 'date' },
  { key: 'pending_milestone_amount', label: 'Pending Amount ($)', width: 150, type: 'number' },
  { key: 'payment_status', label: 'Payment Status',     width: 140, type: 'status' },
];

const PAYMENT_STATUS_COLORS = {
  'Not Paid':        'bg-gray-100 text-gray-600',
  'Invoice Sent':    'bg-blue-100 text-blue-700',
  'Project Pending': 'bg-yellow-100 text-yellow-700',
  'Paid':            'bg-green-100 text-green-700',
};

export default function PendingRevenue() {
  const { isAdmin } = useAuth();
  const [payments, setPayments]   = useState([]);
  const [customCols, setCustomCols] = useState([]);
  const [cells, setCells]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [sortKey, setSortKey]       = useState(null);
  const [sortDir, setSortDir]       = useState('asc');
  const [filters, setFilters]       = useState({});
  const [showColSettings, setShowColSettings] = useState(false);
  const [newCol, setNewCol] = useState({ column_label: '', cell_type: 'text', dropdown_options: [] });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [pays, cols] = await Promise.all([getAllPayments(), getPendingRevenueColumns()]);
      setPayments(pays);
      setCustomCols(cols);
      if (pays.length > 0) {
        const cellData = await getPendingRevenueCells(pays.map(p => p.id));
        const cellMap = {};
        cellData.forEach(c => {
          if (!cellMap[c.payment_id]) cellMap[c.payment_id] = {};
          cellMap[c.payment_id][c.column_key] = c.value;
        });
        setCells(cellMap);
      }
    } catch (e) { toast.error('Failed to load'); }
    setLoading(false);
  }

  async function saveCell(paymentId, colKey, value) {
    try {
      await upsertPendingRevenueCell({ payment_id: paymentId, column_key: colKey, value });
      setCells(prev => ({ ...prev, [paymentId]: { ...(prev[paymentId] || {}), [colKey]: value } }));
    } catch { toast.error('Failed to save'); }
  }

  async function addCustomCol() {
    if (!newCol.column_label.trim()) { toast.error('Column name required'); return; }
    try {
      const col = await upsertPendingRevenueColumn({
        column_key: `custom_${Date.now()}`,
        column_label: newCol.column_label,
        cell_type: newCol.cell_type,
        dropdown_options: newCol.dropdown_options,
        sort_order: customCols.length,
      });
      setCustomCols(prev => [...prev, col]);
      setNewCol({ column_label: '', cell_type: 'text', dropdown_options: [] });
      toast.success('Column added');
    } catch { toast.error('Failed to add column'); }
  }

  async function removeCustomCol(id) {
    if (!window.confirm('Delete this column?')) return;
    try {
      await deletePendingRevenueColumn(id);
      setCustomCols(prev => prev.filter(c => c.id !== id));
    } catch { toast.error('Failed to delete'); }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function copyToClipboard() {
    const allCols = [...BASE_COLUMNS, ...customCols.map(c => ({ key: c.column_key, label: c.column_label }))];
    const header = allCols.map(c => c.label).join('\t');
    const rows = displayed.map(p => allCols.map(c => {
      if (customCols.find(cc => cc.column_key === c.key)) return cells[p.id]?.[c.key] ?? '';
      return p[c.key] ?? '';
    }).join('\t'));
    navigator.clipboard.writeText([header, ...rows].join('\n')).then(() => toast.success('Copied to clipboard'));
  }

  function exportCSV() {
    const allCols = [...BASE_COLUMNS, ...customCols.map(c => ({ key: c.column_key, label: c.column_label }))];
    const rows = [allCols.map(c => c.label), ...displayed.map(p =>
      allCols.map(c => {
        const v = customCols.find(cc => cc.column_key === c.key) ? (cells[p.id]?.[c.key] ?? '') : (p[c.key] ?? '');
        return `"${String(v).replace(/"/g, '""')}"`;
      })
    )];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pending_revenue.csv'; a.click();
  }

  const displayed = [...payments]
    .filter(p => Object.entries(filters).every(([k, v]) =>
      !v || String(p[k] || '').toLowerCase().includes(v.toLowerCase())
    ))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a[sortKey] ?? ''; const vb = b[sortKey] ?? '';
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Pending Revenue</h1>
          <p className="text-xs text-gray-500 mt-0.5">Auto-populated from project payment tabs. {displayed.length} rows.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin() && (
            <button onClick={() => setShowColSettings(o => !o)}
              className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <Settings className="w-3.5 h-3.5" /> Columns
            </button>
          )}
          <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Custom column settings */}
      {showColSettings && isAdmin() && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Custom Columns</h3>
          {customCols.map(col => (
            <div key={col.id} className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-700 flex-1">{col.column_label} ({col.cell_type})</span>
              <button onClick={() => removeCustomCol(col.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
            <input type="text" placeholder="Column name" value={newCol.column_label}
              onChange={e => setNewCol(n => ({ ...n, column_label: e.target.value }))}
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={newCol.cell_type} onChange={e => setNewCol(n => ({ ...n, cell_type: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none">
              <option value="text">Text</option>
              <option value="dropdown">Dropdown</option>
            </select>
            {newCol.cell_type === 'dropdown' && (
              <input type="text" placeholder="Options (comma-separated)"
                onChange={e => setNewCol(n => ({ ...n, dropdown_options: e.target.value.split(',').map(s => s.trim()) }))}
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none" />
            )}
            <button onClick={addCustomCol} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Add</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 text-left w-8">#</th>
                {[...BASE_COLUMNS, ...customCols.map(c => ({ key: c.column_key, label: c.column_label, width: 140, customCol: c }))].map(col => (
                  <th key={col.key} style={{ minWidth: col.width }} className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">
                    <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-gray-900">
                      {col.label}
                      {sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                    </button>
                    <input placeholder="Filter..." value={filters[col.key] || ''}
                      onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-400" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((pay, i) => (
                <tr key={pay.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                  {BASE_COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-2" style={{ minWidth: col.width }}>
                      {col.type === 'link' ? (
                        <a href={pay[col.key]} className="text-blue-600 hover:underline text-xs truncate block max-w-xs">
                          View Project →
                        </a>
                      ) : col.type === 'status' ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[pay[col.key]] || 'bg-gray-100 text-gray-600'}`}>
                          {pay[col.key] || '—'}
                        </span>
                      ) : col.type === 'date' ? (
                        <span className="text-sm text-gray-700">{formatDate(pay[col.key]) || '—'}</span>
                      ) : col.type === 'number' ? (
                        <span className="text-sm text-gray-700 font-medium">
                          {pay[col.key] != null ? Number(pay[col.key]).toLocaleString() : '—'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-700">{pay[col.key] || '—'}</span>
                      )}
                    </td>
                  ))}
                  {customCols.map(col => (
                    <td key={col.column_key} className="px-3 py-2" style={{ minWidth: 140 }}>
                      {isAdmin() ? (
                        col.cell_type === 'dropdown' ? (
                          <select
                            value={cells[pay.id]?.[col.column_key] || ''}
                            onChange={e => saveCell(pay.id, col.column_key, e.target.value)}
                            className="border border-gray-200 rounded px-2 py-0.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            <option value="">—</option>
                            {(col.dropdown_options || []).map(o => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={cells[pay.id]?.[col.column_key] || ''}
                            onChange={e => saveCell(pay.id, col.column_key, e.target.value)}
                            className="border border-gray-200 rounded px-2 py-0.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        )
                      ) : (
                        <span className="text-sm text-gray-700">{cells[pay.id]?.[col.column_key] || '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={BASE_COLUMNS.length + customCols.length + 1} className="px-4 py-8 text-center text-sm text-gray-400">No payment data found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
