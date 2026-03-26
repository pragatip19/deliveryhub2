import { useState, useEffect, useCallback } from 'react';
import { Plus, MoreVertical, Trash2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getRaidItems, upsertRaidItem, deleteRaidItem } from '../../../lib/supabase';

const TYPE_CONFIG = {
  risk:        { label: 'Risks',        headerColor: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-700',      accent: 'text-red-600' },
  assumption:  { label: 'Assumptions',  headerColor: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',    accent: 'text-blue-600' },
  issue:       { label: 'Issues',       headerColor: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', accent: 'text-orange-600' },
  dependency:  { label: 'Dependencies', headerColor: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', accent: 'text-purple-600' },
};

const STATUS_COLORS = {
  'Open':        'bg-red-100 text-red-700',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Resolved':    'bg-emerald-100 text-emerald-700',
  'Closed':      'bg-gray-100 text-gray-600',
  'Accepted':    'bg-blue-100 text-blue-700',
};
const IMPACT_COLORS = {
  'High':   'bg-red-100 text-red-700',
  'Medium': 'bg-amber-100 text-amber-700',
  'Low':    'bg-emerald-100 text-emerald-700',
};

const STATUS_OPTIONS      = ['Open', 'In Progress', 'Resolved', 'Closed', 'Accepted'];
const IMPACT_OPTIONS      = ['High', 'Medium', 'Low'];
const PROBABILITY_OPTIONS = ['High', 'Medium', 'Low'];

const ColoredSelect = ({ value, options, colorMap, onChange, disabled }) => {
  const cls = (colorMap || {})[value] || 'bg-white text-gray-700';
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}
      className={`px-2 py-1 rounded text-xs font-medium border border-gray-200 focus:outline-none focus:border-blue-400 ${cls}`}>
      <option value="">—</option>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
};

export default function RaidTable({ project, canEdit, type }) {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState(null);  // which row is expanded
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // draft of expanded item

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.risk;

  useEffect(() => { load(); }, [project.id, type]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const h = () => setOpenMenuId(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [openMenuId]);

  async function load() {
    setLoading(true);
    try {
      const data = await getRaidItems(project.id, type);
      setItems(data || []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }

  async function save(item) {
    try {
      const saved = await upsertRaidItem({ ...item, project_id: project.id, type });
      setItems(prev => prev.find(i => i.id === saved.id)
        ? prev.map(i => i.id === saved.id ? saved : i)
        : [...prev, saved]);
      return saved;
    } catch { toast.error('Failed to save'); }
  }

  async function remove(id) {
    try {
      await deleteRaidItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      if (expandedId === id) { setExpandedId(null); setEditingItem(null); }
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }

  function handleAddRow() {
    const draft = { title: '', status: 'Open', impact: 'Medium', probability: 'Medium', owner: '', description: '', due_date: '', sort_order: items.length };
    save(draft).then(saved => {
      if (saved) {
        setExpandedId(saved.id);
        setEditingItem({ ...saved });
      }
    });
  }

  function toggleExpand(item) {
    if (expandedId === item.id) {
      setExpandedId(null);
      setEditingItem(null);
    } else {
      setExpandedId(item.id);
      setEditingItem({ ...item });
    }
  }

  function handleFieldChange(field, value) {
    setEditingItem(prev => ({ ...prev, [field]: value }));
  }

  async function saveEditing() {
    if (!editingItem) return;
    const saved = await save(editingItem);
    if (saved) { setEditingItem({ ...saved }); toast.success('Saved'); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-24">
      <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4">
      {/* Section header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl border ${config.headerColor}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${config.accent}`}>{config.label}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>{items.length}</span>
        </div>
        {canEdit && (
          <button onClick={handleAddRow}
            className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700">
            <Plus size={12} /> Add {config.label.replace(/s$/, '')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No {config.label.toLowerCase()} yet. {canEdit && 'Click "Add" to create one.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
                <th className="w-8 px-2 py-2" />
                <th className="w-8 px-2 py-2 text-center">#</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left w-28">Status</th>
                <th className="px-3 py-2 text-left w-24">Impact</th>
                <th className="px-3 py-2 text-left w-24">Probability</th>
                <th className="px-3 py-2 text-left w-32">Owner</th>
                <th className="px-3 py-2 text-left w-28">Due Date</th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <>
                  {/* Summary row — click to expand */}
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${expandedId === item.id ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    onClick={() => toggleExpand(item)}
                  >
                    {/* Expand icon */}
                    <td className="px-2 py-2 text-gray-400">
                      {expandedId === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-400 text-center">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-xs">{item.title || <span className="text-gray-400 italic">Untitled</span>}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status || '—'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[item.impact] || 'bg-gray-100 text-gray-600'}`}>{item.impact || '—'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[item.probability] || 'bg-gray-100 text-gray-600'}`}>{item.probability || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.owner || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.due_date || '—'}</td>
                    {/* Three-dots */}
                    <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                          className="p-1 hover:bg-gray-200 rounded transition">
                          <MoreVertical size={13} className="text-gray-400" />
                        </button>
                        {openMenuId === item.id && canEdit && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-24">
                              <button onClick={() => { setOpenMenuId(null); remove(item.id); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail panel */}
                  {expandedId === item.id && editingItem && (
                    <tr key={`${item.id}_expand`} className="bg-blue-50/40 border-b border-blue-200">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Title */}
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                            {canEdit
                              ? <input type="text" value={editingItem.title || ''} onChange={e => handleFieldChange('title', e.target.value)}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
                              : <span className="text-sm text-gray-800">{editingItem.title || '—'}</span>}
                          </div>

                          {/* Description */}
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                            {canEdit
                              ? <textarea value={editingItem.description || ''} onChange={e => handleFieldChange('description', e.target.value)}
                                  rows={3} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400 resize-none" />
                              : <span className="text-sm text-gray-800 whitespace-pre-wrap">{editingItem.description || '—'}</span>}
                          </div>

                          {/* Status */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                            {canEdit
                              ? <ColoredSelect value={editingItem.status} options={STATUS_OPTIONS} colorMap={STATUS_COLORS} onChange={v => handleFieldChange('status', v)} />
                              : <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[editingItem.status] || ''}`}>{editingItem.status}</span>}
                          </div>

                          {/* Impact */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Impact</label>
                            {canEdit
                              ? <ColoredSelect value={editingItem.impact} options={IMPACT_OPTIONS} colorMap={IMPACT_COLORS} onChange={v => handleFieldChange('impact', v)} />
                              : <span className={`px-2 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[editingItem.impact] || ''}`}>{editingItem.impact}</span>}
                          </div>

                          {/* Probability */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Probability</label>
                            {canEdit
                              ? <ColoredSelect value={editingItem.probability} options={PROBABILITY_OPTIONS} colorMap={IMPACT_COLORS} onChange={v => handleFieldChange('probability', v)} />
                              : <span className={`px-2 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[editingItem.probability] || ''}`}>{editingItem.probability}</span>}
                          </div>

                          {/* Owner */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Owner</label>
                            {canEdit
                              ? <input type="text" value={editingItem.owner || ''} onChange={e => handleFieldChange('owner', e.target.value)}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
                              : <span className="text-sm text-gray-800">{editingItem.owner || '—'}</span>}
                          </div>

                          {/* Due Date */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
                            {canEdit
                              ? <input type="date" value={editingItem.due_date || ''} onChange={e => handleFieldChange('due_date', e.target.value)}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
                              : <span className="text-sm text-gray-800">{editingItem.due_date || '—'}</span>}
                          </div>
                        </div>

                        {/* Save / Close */}
                        {canEdit && (
                          <div className="flex items-center gap-2 mt-4">
                            <button onClick={saveEditing}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
                              Save
                            </button>
                            <button onClick={() => { setExpandedId(null); setEditingItem(null); }}
                              className="px-4 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition">
                              Close
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
