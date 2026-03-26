import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, MoreVertical, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPlanTasks, upsertPlanTask, deletePlanTask, getPeople } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

// ── Delivery Plan uses the project_plan table but shows a client-facing columnar view ──

// ── Color maps ────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  'Ext': 'bg-blue-100 text-blue-700',
  'Int': 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-700',
  'In Progress':  'bg-yellow-100 text-yellow-800',
  'Done':         'bg-emerald-100 text-emerald-700',
  'Blocked':      'bg-red-100 text-red-700',
  'Not Applicable': 'bg-gray-50 text-gray-400',
};

const TYPE_OPTIONS   = ['Ext', 'Int'];
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Done', 'Blocked', 'Not Applicable'];

// ── Milestone color palette (cycled) ─────────────────────────────────────────
const MILESTONE_BG = [
  '#dbeafe', '#ede9fe', '#d1fae5', '#ffedd5',
  '#fce7f3', '#ccfbf1', '#fef3c7', '#cffafe',
];

// ── Colored select dropdown ───────────────────────────────────────────────────
const ColoredSelect = ({ value, options, colorMap, onChange, disabled }) => {
  const cls = colorMap[value] || 'bg-white text-gray-700';
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-1.5 py-0.5 rounded text-xs font-medium border border-gray-200 focus:outline-none focus:border-blue-400 ${cls}`}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

// ── Column definitions ────────────────────────────────────────────────────────
const DEFAULT_COLS = {
  actions:      36,
  milestone:   160,
  activities:  240,
  type:         70,
  status:      130,
  owner:       140,
  duration:     80,
  planned_start: 110,
  planned_end:   110,
  actual_start:  110,
  actual_end:    110,
  dependency:   180,
  notes:        200,
};

const COL_DEFS = [
  { key: 'milestone',    label: 'Milestone',     type: 'text' },
  { key: 'activities',   label: 'Activities',    type: 'text' },
  { key: 'type',         label: 'Type',          type: 'type' },
  { key: 'status',       label: 'Status',        type: 'status' },
  { key: 'owner',        label: 'Owner',         type: 'people' },
  { key: 'duration',     label: 'Actual Days',   type: 'number' },
  { key: 'planned_start', label: 'Planned Start', type: 'date' },
  { key: 'planned_end',  label: 'Planned End',   type: 'date' },
  { key: 'actual_start', label: 'Actual Start',  type: 'date' },
  { key: 'current_end',  label: 'Actual End',    type: 'date',  dbKey: 'current_end' },
  { key: 'dependency',   label: 'Dependency',    type: 'text' },
  { key: 'notes',        label: 'Comments',      type: 'text',  dbKey: 'learnings' },
];

// ── Milestone color index ─────────────────────────────────────────────────────
function getMilestoneColor(name, map) {
  if (!map[name]) {
    map[name] = MILESTONE_BG[Object.keys(map).length % MILESTONE_BG.length];
  }
  return map[name];
}

export default function DeliveryPlanTab({ project, canEdit }) {
  const { isAdmin, isDM } = useAuth();
  const [tasks, setTasks]   = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Column widths
  const LS_COL_KEY = `dpCols_${project?.id}`;
  const [colWidths, setColWidths] = useState(() => {
    try { const s = localStorage.getItem(LS_COL_KEY); return s ? { ...DEFAULT_COLS, ...JSON.parse(s) } : { ...DEFAULT_COLS }; }
    catch { return { ...DEFAULT_COLS }; }
  });
  const colResizingRef = useRef(null);

  // Row heights
  const LS_ROW_KEY = `dpRows_${project?.id}`;
  const [rowHeights, setRowHeights] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_ROW_KEY)) || {}; }
    catch { return {}; }
  });
  const rowResizingRef = useRef(null);

  // Track milestone colors across renders
  const milestoneColorMap = useRef({});

  useEffect(() => {
    try { localStorage.setItem(LS_COL_KEY, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  useEffect(() => {
    try { localStorage.setItem(LS_ROW_KEY, JSON.stringify(rowHeights)); } catch {}
  }, [rowHeights]);

  // ── Mouse resize events ───────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = e => {
      if (colResizingRef.current) {
        const { key, startX, startW } = colResizingRef.current;
        setColWidths(p => ({ ...p, [key]: Math.max(50, startW + (e.clientX - startX)) }));
      }
      if (rowResizingRef.current) {
        const { id, startY, startH } = rowResizingRef.current;
        setRowHeights(p => ({ ...p, [id]: Math.max(28, startH + (e.clientY - startY)) }));
      }
    };
    const onUp = () => { colResizingRef.current = null; rowResizingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Load data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [taskData, peopleData] = await Promise.all([
          getPlanTasks(project.id),
          getPeople(project.id),
        ]);
        setTasks(taskData || []);
        setPeople(peopleData || []);
      } catch { toast.error('Failed to load Delivery Plan'); }
      finally { setLoading(false); }
    }
    if (project?.id) load();
  }, [project?.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const h = () => setOpenMenuId(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [openMenuId]);

  // ── Debounced save ────────────────────────────────────────────────────────────
  const debouncedSave = useCallback(
    (() => {
      const timers = {};
      return (task) => {
        clearTimeout(timers[task.id]);
        timers[task.id] = setTimeout(async () => {
          try { await upsertPlanTask(task); }
          catch (e) { toast.error('Failed to save: ' + (e?.message || '')); }
        }, 800);
      };
    })(),
    []
  );

  const handleCellChange = useCallback((taskId, field, value) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId ? { ...t, [field]: value } : t);
      const task = next.find(t => t.id === taskId);
      if (task) debouncedSave(task);
      return next;
    });
  }, [debouncedSave]);

  const handleAddRow = useCallback(() => {
    const newTask = {
      id: crypto.randomUUID(),
      project_id: project.id,
      milestone: '',
      activities: '',
      tools: 'Ext', // type field stored in tools
      status: 'Not Started',
      owner: '',
      duration: null,
      planned_start: null,
      planned_end: null,
      actual_start: null,
      current_end: null,
      dependency: '',
      learnings: '', // comments field
      sort_order: Date.now(),
    };
    setTasks(prev => [...prev, newTask]);
    debouncedSave(newTask);
  }, [project.id, debouncedSave]);

  const handleDelete = useCallback(async (taskId) => {
    try {
      await deletePlanTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Row deleted');
    } catch { toast.error('Failed to delete'); }
  }, []);

  const handleExport = useCallback(() => {
    const headers = COL_DEFS.map(c => c.label);
    const rows = tasks.map(t => COL_DEFS.map(c => {
      const field = c.dbKey || c.key;
      if (field === 'tools') return t.tools || '';
      return t[field] ?? '';
    }));
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `delivery_plan_${project.id}.csv`;
    a.click();
    toast.success('Exported');
  }, [tasks, project.id]);

  const cw = k => ({ width: colWidths[k] || DEFAULT_COLS[k] || 100, minWidth: colWidths[k] || DEFAULT_COLS[k] || 100 });

  const ResizeHandle = ({ colKey }) => (
    <div
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 z-10"
      onMouseDown={e => {
        e.preventDefault(); e.stopPropagation();
        colResizingRef.current = { key: colKey, startX: e.clientX, startW: colWidths[colKey] || DEFAULT_COLS[colKey] || 100 };
      }}
    />
  );

  const canDelete = isAdmin() || isDM();

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );

  // Rebuild milestone color map from current tasks
  milestoneColorMap.current = {};
  tasks.forEach(t => { if (t.milestone) getMilestoneColor(t.milestone, milestoneColorMap.current); });

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Delivery Plan</h3>
          <p className="text-xs text-gray-500 mt-0.5">Resize columns/rows by dragging borders · Double-click cells to edit</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              <Plus size={16} /> Add Row
            </button>
          )}
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg select-none">
        <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              {/* Actions column */}
              <th className="relative border-r border-gray-200 bg-gray-100" style={cw('actions')}>
                <ResizeHandle colKey="actions" />
              </th>
              {COL_DEFS.map(col => (
                <th
                  key={col.key}
                  className="relative px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 text-[11px]"
                  style={cw(col.key)}
                >
                  {col.label}
                  <ResizeHandle colKey={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, idx) => {
              const mColor = task.milestone
                ? getMilestoneColor(task.milestone, milestoneColorMap.current)
                : null;

              return (
                <tr
                  key={task.id}
                  className="border-b border-gray-100 hover:bg-blue-50/20 transition"
                  style={{ height: rowHeights[task.id] || 34, position: 'relative' }}
                >
                  {/* Three-dots actions */}
                  <td className="border-r border-gray-200 text-center" style={cw('actions')}>
                    <div className="relative flex items-center justify-center h-full py-1">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === task.id ? null : task.id); }}
                        className="p-1 hover:bg-gray-200 rounded transition"
                      >
                        <MoreVertical size={12} className="text-gray-400" />
                      </button>
                      {openMenuId === task.id && canDelete && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute left-7 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-24">
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(task.id); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Milestone */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={{ ...cw('milestone'), backgroundColor: mColor || undefined }}>
                    {canEdit ? (
                      <input
                        type="text"
                        value={task.milestone || ''}
                        onChange={e => handleCellChange(task.id, 'milestone', e.target.value)}
                        className="w-full px-1.5 py-0.5 border-0 bg-transparent rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white"
                        style={{ background: 'transparent' }}
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-700">{task.milestone || '—'}</span>
                    )}
                  </td>

                  {/* Activities */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('activities')}>
                    {canEdit ? (
                      <input type="text" value={task.activities || ''}
                        onChange={e => handleCellChange(task.id, 'activities', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.activities || '—'}</span>}
                  </td>

                  {/* Type (Ext / Int) — stored in `tools` field */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('type')}>
                    {canEdit ? (
                      <ColoredSelect
                        value={task.tools}
                        options={TYPE_OPTIONS}
                        colorMap={TYPE_COLORS}
                        onChange={v => handleCellChange(task.id, 'tools', v)}
                      />
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[task.tools] || 'bg-gray-100 text-gray-600'}`}>
                        {task.tools || '—'}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('status')}>
                    {canEdit ? (
                      <ColoredSelect
                        value={task.status}
                        options={STATUS_OPTIONS}
                        colorMap={STATUS_COLORS}
                        onChange={v => handleCellChange(task.id, 'status', v)}
                      />
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600'}`}>
                        {task.status || '—'}
                      </span>
                    )}
                  </td>

                  {/* Owner — freetext (or from people list) */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('owner')}>
                    {canEdit ? (
                      <input type="text" value={task.owner || ''}
                        onChange={e => handleCellChange(task.id, 'owner', e.target.value)}
                        list={`people_${task.id}`}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.owner || '—'}</span>}
                    {canEdit && (
                      <datalist id={`people_${task.id}`}>
                        {people.map(p => <option key={p.id} value={p.name} />)}
                      </datalist>
                    )}
                  </td>

                  {/* Duration / Actual Days */}
                  <td className="px-1 py-0.5 border-r border-gray-200 text-right" style={cw('duration')}>
                    {canEdit ? (
                      <input type="number" value={task.duration ?? ''}
                        onChange={e => handleCellChange(task.id, 'duration', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.duration ?? '—'}</span>}
                  </td>

                  {/* Planned Start */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('planned_start')}>
                    {canEdit ? (
                      <input type="date" value={task.planned_start || ''}
                        onChange={e => handleCellChange(task.id, 'planned_start', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.planned_start || '—'}</span>}
                  </td>

                  {/* Planned End */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('planned_end')}>
                    {canEdit ? (
                      <input type="date" value={task.planned_end || ''}
                        onChange={e => handleCellChange(task.id, 'planned_end', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.planned_end || '—'}</span>}
                  </td>

                  {/* Actual Start */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('actual_start')}>
                    {canEdit ? (
                      <input type="date" value={task.actual_start || ''}
                        onChange={e => handleCellChange(task.id, 'actual_start', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.actual_start || '—'}</span>}
                  </td>

                  {/* Actual End */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('current_end')}>
                    {canEdit ? (
                      <input type="date" value={task.current_end || ''}
                        onChange={e => handleCellChange(task.id, 'current_end', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.current_end || '—'}</span>}
                  </td>

                  {/* Dependency */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('dependency')}>
                    {canEdit ? (
                      <input type="text" value={task.dependency || ''}
                        onChange={e => handleCellChange(task.id, 'dependency', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.dependency || '—'}</span>}
                  </td>

                  {/* Comments (stored in learnings) */}
                  <td className="px-1 py-0.5 border-r border-gray-200" style={cw('notes')}>
                    {canEdit ? (
                      <input type="text" value={task.learnings || ''}
                        onChange={e => handleCellChange(task.id, 'learnings', e.target.value)}
                        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                    ) : <span>{task.learnings || '—'}</span>}
                  </td>

                  {/* Row resize handle */}
                  <div
                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, cursor: 'row-resize', zIndex: 5 }}
                    onMouseDown={e => {
                      e.preventDefault();
                      rowResizingRef.current = { id: task.id, startY: e.clientY, startH: rowHeights[task.id] || 34 };
                    }}
                    className="hover:bg-blue-300 opacity-0 hover:opacity-50 transition"
                  />
                </tr>
              );
            })}

            {tasks.length === 0 && (
              <tr>
                <td colSpan={COL_DEFS.length + 1} className="px-4 py-10 text-center text-sm text-gray-400">
                  No rows yet. {canEdit && 'Click "Add Row" to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        Drag column borders to resize · Drag row borders to resize rows · Type is stored as Ext (External) or Int (Internal)
      </p>
    </div>
  );
}
