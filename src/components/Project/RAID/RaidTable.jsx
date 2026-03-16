import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getRaidItems, upsertRaidItem, deleteRaidItem } from '../../../lib/supabase';

const TYPE_CONFIG = {
  risk:        { label: 'Risks',        color: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-700' },
  assumption:  { label: 'Assumptions',  color: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  issue:       { label: 'Issues',       color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  dependency:  { label: 'Dependencies', color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700' },
};

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed', 'Accepted'];
const IMPACT_OPTIONS = ['High', 'Medium', 'Low'];
const PROBABILITY_OPTIONS = ['High', 'Medium', 'Low'];

const COLUMNS = [
  { key: 'title',       label: 'Title',       width: 200 },
  { key: 'description', label: 'Description', width: 280 },
  { key: 'impact',      label: 'Impact',      width: 100, type: 'select', options: IMPACT_OPTIONS },
  { key: 'probability', label: 'Probability', width: 110, type: 'select', options: PROBABILITY_OPTIONS },
  { key: 'status',      label: 'Status',      width: 120, type: 'select', options: STATUS_OPTIONS },
  { key: 'owner',       label: 'Owner',       width: 140 },
  { key: 'due_date',    label: 'Due Date',    width: 120, type: 'date' },
];

export default function RaidTable({ project, canEdit, type }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');
  const [filters, setFilters]   = useState({});

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.risk;

  useEffect(() => { load(); }, [project.id, type]);

  async function load() {
    setLoading(true);
    try {
      const data = await getRaidItems(project.id, type);
      setItems(data);
    } catch (e) { toast.error('Failed to load'); }
    setLoading(false);
  }

  async function save(item) {
    try {
      const saved = await upsertRaidItem({ ...item, project_id: project.id, type });
      setItems(prev => prev.find(i => i.id === saved.id)
        ? prev.map(i => i.id === saved.id ? saved : i)
        : [...prev, saved]);
    } catch (e) { toast.error('Failed to save'); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteRaidItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) { toast.error('Failed to delete'); }
  }

  function addRow() {
    save({ title: 'New Item', status: 'Open', sort_order: items.length });
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const displayed = [...items]
    .filter(item => Object.entries(filters).every(([k, v]) =>
      !v || String(item[k] || '').toLowerCase().includes(v.toLowerCase())
    ))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a[sortKey] || ''; const vb = b[sortKey] || '';
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">{config.label}</h2>
        {canEdit && (
          <button onClick={addRow} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add {config.label.slice(0, -1)}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs w-8">#</th>
                {COLUMNS.map(col => (
                  <th key={col.key} className="text-left px-3 py-2.5 font-medium text-gray-600 text-xs" style={{ width: col.width }}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-gray-900">
                        {col.label}
                        {sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                      </button>
                    </div>
                    <input
                      placeholder="Filter..."
                      value={filters[col.key] || ''}
                      onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-400"
                    />
                  </th>
                ))}
                {canEdit && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-2">
                      {col.type === 'select' ? (
                        <select
                          disabled={!canEdit}
                          value={item[col.key] || ''}
                          onChange={e => save({ ...item, [col.key]: e.target.value })}
                          className="border-0 bg-transparent text-sm w-full focus:outline-none cursor-pointer"
                        >
                          <option value="">—</option>
                          {col.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : col.type === 'date' ? (
                        <input
                          type="date"
                          disabled={!canEdit}
                          value={item[col.key] || ''}
                          onChange={e => save({ ...item, [col.key]: e.target.value })}
                          className="border-0 bg-transparent text-sm w-full focus:outline-none"
                        />
                      ) : (
                        <InlineEdit
                          value={item[col.key] || ''}
                          canEdit={canEdit}
                          onSave={v => save({ ...item, [col.key]: v })}
                          multiline={col.key === 'description'}
                        />
                      )}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-2 py-2">
                      <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">No {config.label.toLowerCase()} added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InlineEdit({ value, onSave, canEdit, multiline }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  function commit() { setEditing(false); if (val !== value) onSave(val); }
  if (!canEdit) return <span className="text-gray-700 whitespace-pre-wrap">{value || '—'}</span>;
  if (editing) {
    const props = {
      autoFocus: true, value: val,
      onChange: e => setVal(e.target.value),
      onBlur: commit,
      className: 'w-full border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none',
    };
    return multiline
      ? <textarea {...props} rows={2} onKeyDown={e => { if (e.key === 'Escape') { setVal(value); setEditing(false); } }} />
      : <input {...props} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }} />;
  }
  return (
    <span onClick={() => setEditing(true)} className="block cursor-text hover:bg-blue-50 rounded px-1 py-0.5 transition min-h-[1.5rem] whitespace-pre-wrap text-gray-700">
      {value || <span className="text-gray-300 italic">—</span>}
    </span>
  );
}
