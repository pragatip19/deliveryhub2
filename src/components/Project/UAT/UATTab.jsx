import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, MoreVertical, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUATItems, upsertUATItem, deleteUATItem, getPeople } from '../../../lib/supabase';
import { UAT_STATUS_OPTIONS, UAT_BATCH_STATUS_OPTIONS } from '../../../lib/templates';
import { useAuth } from '../../../contexts/AuthContext';
import { useSpreadsheet } from '../../../lib/useSpreadsheet';
import { SCell } from '../../shared/SCell';

// ── Color maps ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Not Started':    'bg-gray-100 text-gray-700',
  'Ready for UAT':  'bg-blue-100 text-blue-700',
  'In Progress':    'bg-yellow-100 text-yellow-800',
  'Under Reconfig': 'bg-orange-100 text-orange-700',
  'UAT Complete':   'bg-green-100 text-green-800',
  'Signed Off':     'bg-emerald-100 text-emerald-800',
};
const BATCH_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done':        'bg-emerald-100 text-emerald-700',
  'Blocked':     'bg-red-100 text-red-700',
};

// Read-only colored pill
const StatusPill = ({ value, colorMap }) => {
  const cls = colorMap[value] || 'bg-gray-100 text-gray-700';
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{value || '—'}</span>;
};

// ── MES UAT groups ────────────────────────────────────────────────────────────
const MES_GROUPS = ['BMR', 'BPR', 'Logbooks / Processes'];
const LOG_GROUPS = ['Logbooks / Processes'];

const EDIT_COLS_MES = ['process', 'status', 'approver', 'batch1', 'batch2', 'batch3', 'paper', 'elim', 'auto', 'ctrl', 'rem', 'inter', 'comp'];
const EDIT_COLS_LOG = ['process', 'status', 'approver', 'paper', 'elim', 'auto', 'ctrl', 'rem', 'inter', 'comp'];

export default function UATTab({ project, canEdit }) {
  const { user, isAdmin, isDM } = useAuth();
  const [uatItems, setUatItems] = useState([]);
  const [people, setPeople]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const ss = useSpreadsheet();

  // Global batch dates
  const [batchDates, setBatchDates] = useState({
    batch_1_start: '', batch_1_end: '',
    batch_2_start: '', batch_2_end: '',
    batch_3_start: '', batch_3_end: '',
  });
  const [batchCfgId, setBatchCfgId] = useState(null);

  // ── Column widths (resizable) ────────────────────────────────────────────────
  const COL_LS_KEY = `uatCols_${project?.id}`;
  const DEFAULT_COLS = {
    actions: 32, process: 180, status: 130, approver: 130,
    batch1: 100, batch2: 100, batch3: 100,
    paper: 80, elim: 80, auto: 80, ctrl: 80, rem: 80, inter: 80, comp: 90,
  };
  const [colWidths, setColWidths] = useState(() => {
    try { const s = localStorage.getItem(COL_LS_KEY); return s ? { ...DEFAULT_COLS, ...JSON.parse(s) } : { ...DEFAULT_COLS }; }
    catch { return { ...DEFAULT_COLS }; }
  });
  const colResizingRef = useRef(null);

  // ── Row heights (resizable) ──────────────────────────────────────────────────
  const ROW_LS_KEY = `uatRows_${project?.id}`;
  const [rowHeights, setRowHeights] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ROW_LS_KEY)) || {}; }
    catch { return {}; }
  });
  const rowResizingRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(COL_LS_KEY, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  useEffect(() => {
    try { localStorage.setItem(ROW_LS_KEY, JSON.stringify(rowHeights)); } catch {}
  }, [rowHeights]);

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

  const ResizeHandle = ({ colKey }) => (
    <div
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 z-10"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); colResizingRef.current = { key: colKey, startX: e.clientX, startW: colWidths[colKey] }; }}
    />
  );

  const isMES      = project?.uat_type === 'mes';
  const isLogbooks = project?.uat_type === 'logbooks';
  const groups     = isMES ? MES_GROUPS : LOG_GROUPS;
  const canDelete  = isAdmin() || isDM();
  const editCols   = isMES ? EDIT_COLS_MES : EDIT_COLS_LOG;

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [items, peopleList] = await Promise.all([
          getUATItems(project.id),
          getPeople(project.id),
        ]);
        setUatItems(items || []);
        setPeople(peopleList || []);
        const cfg = (items || []).find(i => i.group_name === '__batch_config');
        if (cfg) {
          setBatchCfgId(cfg.id);
          setBatchDates({
            batch_1_start: cfg.batch_1_start || '',
            batch_1_end:   cfg.batch_1_end   || '',
            batch_2_start: cfg.batch_2_start || '',
            batch_2_end:   cfg.batch_2_end   || '',
            batch_3_start: cfg.batch_3_start || '',
            batch_3_end:   cfg.batch_3_end   || '',
          });
        }
      } catch { toast.error('Failed to load UAT data'); }
      finally   { setLoading(false); }
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

  // ── Save helpers ─────────────────────────────────────────────────────────────
  const debouncedSave = useCallback(
    (() => {
      let t;
      return (item) => {
        clearTimeout(t);
        t = setTimeout(async () => {
          try { await upsertUATItem(item); }
          catch (e) { toast.error('Failed to save UAT item: ' + (e?.message || '')); }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleChange = useCallback((itemId, field, value) => {
    setUatItems(prev => {
      const next = prev.map(i => i.id === itemId ? { ...i, [field]: value } : i);
      const item = next.find(i => i.id === itemId);
      if (item) debouncedSave(item);
      return next;
    });
  }, [debouncedSave]);

  const handleBatchDateChange = useCallback((key, value) => {
    setBatchDates(prev => {
      const next = { ...prev, [key]: value };
      const cfgId = batchCfgId || crypto.randomUUID();
      if (!batchCfgId) setBatchCfgId(cfgId);
      const cfgRow = {
        id: cfgId,
        project_id: project.id,
        group_name: '__batch_config',
        sort_order: -1,
        ...next,
      };
      debouncedSave(cfgRow);
      return next;
    });
  }, [batchCfgId, project.id, debouncedSave]);

  const handleAddRow = useCallback((groupName) => {
    const newItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      group_name: groupName,
      process_name: '',
      status: 'Not Started',
      uat_approver_id: null,
      sort_order: Date.now(),
      ...(isMES && {
        batch_1_status: 'Not Started',
        batch_2_status: 'Not Started',
        batch_3_status: 'Not Started',
        paper_fields: 0, eliminated: 0, automated: 0,
        controlled: 0, remaining: 0, interlocks: 0, compliance_score: 0,
      }),
      ...(!isMES && {
        paper_fields: 0, eliminated: 0, automated: 0,
        controlled: 0, remaining: 0, interlocks: 0, compliance_score: 0,
      }),
    };
    setUatItems(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [project.id, isMES, debouncedSave]);

  const handleDeleteRow = useCallback(async (itemId) => {
    try {
      await deleteUATItem(itemId);
      setUatItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }, []);

  // ── Group rows ───────────────────────────────────────────────────────────────
  const groupedItems = useMemo(() => {
    const result = {};
    groups.forEach(g => {
      result[g] = uatItems.filter(i => i.group_name === g && i.group_name !== '__batch_config');
    });
    return result;
  }, [uatItems, groups]);

  // All visible items (for Tab/Enter navigation across groups)
  const visibleItems = useMemo(() =>
    uatItems.filter(i => i.group_name !== '__batch_config'),
  [uatItems]);

  const cw = k => ({ width: colWidths[k], minWidth: colWidths[k] });

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  if (!isMES && !isLogbooks) return (
    <div className="p-6 text-gray-500 text-sm">
      UAT tracker not configured for this project type. Set <code>uat_type</code> to <code>mes</code> or <code>logbooks</code>.
    </div>
  );

  const thCls = 'relative px-2 py-1.5 text-center font-semibold text-[10px] text-gray-700 border-r border-gray-300';
  const tdCls = 'px-2 py-1 border-r border-gray-200 text-xs';
  const superTh = 'px-2 py-1 text-center text-xs font-bold border-r border-gray-300 bg-gray-200';

  return (
    <div className="p-6 space-y-4" onClick={() => ss.clearAll()}>
      <h3 className="text-lg font-semibold">{isMES ? 'MES' : 'Logbooks'} UAT Tracker</h3>

      <div className="overflow-x-auto border border-gray-300 rounded-lg select-none" onClick={e => e.stopPropagation()}>
        <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
          <thead>
            {/* ── Super-header row ── */}
            <tr className="bg-gray-200 border-b border-gray-300">
              <th className={`${superTh} w-8`} rowSpan={2} />
              <th colSpan={3} className={`${superTh} text-left`}>Configuration</th>
              {isMES && <th colSpan={3} className={superTh}>UAT</th>}
              <th colSpan={7} className={superTh}>Case Study</th>
            </tr>

            {/* ── Column headers ── */}
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className={thCls} style={cw('process')}>
                Process Name
                <ResizeHandle colKey="process" />
              </th>
              <th className={thCls} style={cw('status')}>
                Status
                <ResizeHandle colKey="status" />
              </th>
              <th className={thCls} style={cw('approver')}>
                UAT Approver
                <ResizeHandle colKey="approver" />
              </th>
              {isMES && <>
                <th className={thCls} style={cw('batch1')}>Batch 1<ResizeHandle colKey="batch1" /></th>
                <th className={thCls} style={cw('batch2')}>Batch 2<ResizeHandle colKey="batch2" /></th>
                <th className={thCls} style={cw('batch3')}>Batch 3<ResizeHandle colKey="batch3" /></th>
              </>}
              {[
                ['paper',  'Paper Fields'],
                ['elim',   'Eliminated'],
                ['auto',   'Automated'],
                ['ctrl',   'Controlled'],
                ['rem',    'Remaining'],
                ['inter',  'Interlocks'],
                ['comp',   'Compliance Score'],
              ].map(([k, label]) => (
                <th key={k} className={thCls} style={cw(k)}>
                  {label}
                  <ResizeHandle colKey={k} />
                </th>
              ))}
            </tr>

            {/* ── Batch date rows (MES only) ── */}
            {isMES && <>
              <tr className="bg-blue-50 border-b border-gray-200">
                <td className={`${tdCls} text-gray-500 font-medium`} style={cw('actions')} />
                <td className={`${tdCls} font-medium text-gray-600`} colSpan={3}>Start Date</td>
                {[1,2,3].map(n => (
                  <td key={n} className={tdCls} style={cw(`batch${n}`)}>
                    <input type="date" value={batchDates[`batch_${n}_start`] || ''} disabled={!canEdit}
                      onChange={e => handleBatchDateChange(`batch_${n}_start`, e.target.value)}
                      className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 disabled:bg-transparent" />
                  </td>
                ))}
                <td colSpan={7} />
              </tr>
              <tr className="bg-blue-50 border-b border-gray-300">
                <td className={tdCls} style={cw('actions')} />
                <td className={`${tdCls} font-medium text-gray-600`} colSpan={3}>End Date</td>
                {[1,2,3].map(n => (
                  <td key={n} className={tdCls} style={cw(`batch${n}`)}>
                    <input type="date" value={batchDates[`batch_${n}_end`] || ''} disabled={!canEdit}
                      onChange={e => handleBatchDateChange(`batch_${n}_end`, e.target.value)}
                      className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 disabled:bg-transparent" />
                  </td>
                ))}
                <td colSpan={7} />
              </tr>
            </>}
          </thead>

          <tbody>
            {groups.map(groupName => (
              <React.Fragment key={groupName}>
                {/* Group header */}
                <tr className="bg-gray-100 border-b border-gray-300">
                  <td colSpan={isMES ? 14 : 11} className="px-3 py-1.5 font-bold text-xs text-gray-800">{groupName}</td>
                </tr>

                {/* Data rows */}
                {groupedItems[groupName]?.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={idx % 2 === 0 ? 'bg-white border-b' : 'bg-gray-50 border-b'}
                    style={{ height: rowHeights[item.id] || 36, position: 'relative' }}
                  >
                    {/* Three-dots menu */}
                    <td className="px-1 py-1 border-r border-gray-200" style={cw('actions')}>
                      <div className="relative flex items-center justify-center">
                        <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                          className="p-0.5 hover:bg-gray-200 rounded">
                          <MoreVertical size={12} className="text-gray-400" />
                        </button>
                        {openMenuId === item.id && canDelete && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute left-6 top-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-20">
                              <button onClick={() => { setOpenMenuId(null); handleDeleteRow(item.id); }}
                                className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                                <Trash2 size={10} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Process Name */}
                    <SCell ss={ss} rowId={item.id} colKey="process"
                      value={item.process_name || ''}
                      onChange={v => handleChange(item.id, 'process_name', v)}
                      rows={visibleItems} cols={editCols}
                      placeholder="Process name…"
                      disabled={!canEdit} tdStyle={cw('process')} />

                    {/* Status */}
                    <SCell ss={ss} rowId={item.id} colKey="status"
                      value={item.status || ''}
                      onChange={v => handleChange(item.id, 'status', v)}
                      rows={visibleItems} cols={editCols}
                      type="colored-select" options={UAT_STATUS_OPTIONS} colorMap={STATUS_COLORS}
                      disabled={!canEdit} tdStyle={cw('status')}
                      readView={<StatusPill value={item.status} colorMap={STATUS_COLORS} />} />

                    {/* UAT Approver */}
                    <SCell ss={ss} rowId={item.id} colKey="approver"
                      value={item.uat_approver_id || ''}
                      onChange={v => handleChange(item.id, 'uat_approver_id', v)}
                      rows={visibleItems} cols={editCols}
                      type="select" options={people.map(p => ({ value: p.id, label: p.name }))}
                      disabled={!canEdit} tdStyle={cw('approver')}
                      readView={<span>{people.find(p => p.id === item.uat_approver_id)?.name || '—'}</span>} />

                    {/* Batch statuses (MES only) */}
                    {isMES && [1,2,3].map(n => (
                      <SCell key={n} ss={ss} rowId={item.id} colKey={`batch${n}`}
                        value={item[`batch_${n}_status`] || ''}
                        onChange={v => handleChange(item.id, `batch_${n}_status`, v)}
                        rows={visibleItems} cols={editCols}
                        type="colored-select" options={UAT_BATCH_STATUS_OPTIONS} colorMap={BATCH_STATUS_COLORS}
                        disabled={!canEdit} tdStyle={cw(`batch${n}`)}
                        readView={<StatusPill value={item[`batch_${n}_status`]} colorMap={BATCH_STATUS_COLORS} />} />
                    ))}

                    {/* Numeric fields */}
                    {[
                      ['paper_fields',     'paper'],
                      ['eliminated',       'elim'],
                      ['automated',        'auto'],
                      ['controlled',       'ctrl'],
                      ['remaining',        'rem'],
                      ['interlocks',       'inter'],
                      ['compliance_score', 'comp'],
                    ].map(([field, colKey]) => (
                      <SCell key={field} ss={ss} rowId={item.id} colKey={colKey}
                        value={String(item[field] ?? 0)}
                        onChange={v => handleChange(item.id, field, parseInt(v) || 0)}
                        rows={visibleItems} cols={editCols}
                        type="number"
                        disabled={!canEdit} tdStyle={cw(colKey)} tdClass="text-right"
                        readView={<span className="ml-auto">{item[field] ?? '—'}</span>} />
                    ))}

                    {/* Row resize handle */}
                    <td
                      className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-300 opacity-0 hover:opacity-50"
                      style={{ display: 'block', position: 'absolute' }}
                      onMouseDown={e => {
                        e.preventDefault();
                        rowResizingRef.current = { id: item.id, startY: e.clientY, startH: rowHeights[item.id] || 36 };
                      }}
                    />
                  </tr>
                ))}

                {/* Add Row */}
                {canEdit && (
                  <tr className="bg-gray-50 border-b">
                    <td colSpan={isMES ? 14 : 11} className="px-3 py-1.5">
                      <button onClick={() => handleAddRow(groupName)}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium">
                        <Plus size={13} /> Add Row
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
