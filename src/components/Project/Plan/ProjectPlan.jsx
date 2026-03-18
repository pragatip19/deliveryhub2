import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Eye, Download, Plus, Trash2, ArrowUpDown, MoreVertical,
  Undo2, Redo2, ArrowDownToLine, ArrowUpToLine, Bold, Copy, Clipboard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import debounce from 'lodash.debounce';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getPlanTasks, bulkUpsertPlanTasks, upsertPlanTask, deletePlanTask,
  getMilestones, getPeople,
} from '../../../lib/supabase';
import { STATUS_OPTIONS } from '../../../lib/templates';
import { recalculatePlan, getStatusColor } from '../../../lib/calculations';
import { calcPlannedEnd, formatDate, formatDateInput, parseDate, networkdays } from '../../../lib/workdays';

// ─── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'milestone',              label: 'Milestone',            width: 160, frozen: true,  type: 'milestone' },
  { key: 'activities',             label: 'Activities',           width: 220, frozen: true,  type: 'text' },
  { key: 'tools',                  label: 'Tools',                width: 150, frozen: false, type: 'text' },
  { key: 'owner',                  label: 'Owner',                width: 150, frozen: false, type: 'people' },
  { key: 'status',                 label: 'Status',               width: 130, frozen: false, type: 'status' },
  { key: 'duration',               label: 'Duration',             width: 80,  frozen: false, type: 'number' },
  { key: 'baseline_planned_start', label: 'Baseline Start',       width: 130, frozen: false, type: 'date', adminOnly: true },
  { key: 'baseline_planned_end',   label: 'Baseline End',         width: 130, frozen: false, type: 'date', adminOnly: true },
  { key: 'planned_start',          label: 'Planned Start',        width: 120, frozen: false, type: 'date', specialEdit: true },
  { key: 'planned_end',            label: 'Planned End',          width: 120, frozen: false, type: 'date', readOnly: true },
  { key: 'actual_start',           label: 'Actual Start',         width: 120, frozen: false, type: 'date' },
  { key: 'current_end',            label: 'Current End',          width: 120, frozen: false, type: 'date' },
  { key: 'dependency',             label: 'Dependency',           width: 190, frozen: false, type: 'text' },
  { key: 'deviation',              label: 'Deviation',            width: 110, frozen: false, type: 'text' },
  { key: 'deviation_details',      label: 'Deviation Details',    width: 190, frozen: false, type: 'text' },
  { key: 'delay_status',           label: 'Delay / On Track',     width: 120, frozen: false, type: 'badge',  readOnly: true },
  { key: 'days_delay',             label: 'Days Delay',           width: 90,  frozen: false, type: 'number', readOnly: true },
  { key: 'baseline_delta',         label: 'Baseline Delta',       width: 110, frozen: false, type: 'number', readOnly: true },
  { key: 'learnings',              label: 'Learnings from Delay', width: 200, frozen: false, type: 'text' },
];

// Excel-like background color swatches
const BG_COLORS = [
  { label: 'Yellow',  hex: '#FEF9C3' },
  { label: 'Green',   hex: '#DCFCE7' },
  { label: 'Blue',    hex: '#DBEAFE' },
  { label: 'Pink',    hex: '#FCE7F3' },
  { label: 'Purple',  hex: '#EDE9FE' },
  { label: 'Red',     hex: '#FEE2E2' },
  { label: 'Orange',  hex: '#FFEDD5' },
  { label: 'Teal',    hex: '#CCFBF1' },
];

const MILESTONE_PALETTE = [
  { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-l-2 border-blue-400',    rowTop: 'border-t-2 border-blue-200'    },
  { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-l-2 border-violet-400',  rowTop: 'border-t-2 border-violet-200'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-l-2 border-emerald-400', rowTop: 'border-t-2 border-emerald-200' },
  { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-l-2 border-orange-400',  rowTop: 'border-t-2 border-orange-200'  },
  { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-l-2 border-pink-400',    rowTop: 'border-t-2 border-pink-200'    },
  { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-l-2 border-teal-400',    rowTop: 'border-t-2 border-teal-200'    },
  { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-l-2 border-amber-400',   rowTop: 'border-t-2 border-amber-200'   },
  { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-l-2 border-cyan-400',    rowTop: 'border-t-2 border-cyan-200'    },
];

const ProjectPlan = ({ project, canEdit }) => {
  const { isAdmin: isAdminFn } = useAuth();
  const isProjectAdmin = canEdit && isAdminFn();
  const isDM = canEdit;

  const [tasks, setTasks]             = useState([]);
  const [milestones, setMilestones]   = useState([]);
  const [people, setPeople]           = useState([]);
  const [visibleCols, setVisibleCols] = useState(() => {
    const init = {}; COLUMNS.forEach(c => { init[c.key] = true; }); return init;
  });
  const [sortConfig, setSortConfig]   = useState({ col: null, dir: 'asc' });
  const [showColMenu, setShowColMenu] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);  // { taskId, col } — single-click select
  const [editCell, setEditCell]       = useState(null);    // { taskId, col } — double-click edit
  const [copiedCell, setCopiedCell]   = useState(null);    // { taskId, col, value }
  const [toolbarPos, setToolbarPos]   = useState(null);    // { top, left } fixed position
  const [loading, setLoading]         = useState(true);
  const [openMenu, setOpenMenu]       = useState(null);

  // Undo/redo
  const historyRef    = useRef([]);
  const histIdxRef    = useRef(-1);
  const isUndoRedoRef = useRef(false);

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    (async () => {
      setLoading(true);
      try {
        const [t, m, p] = await Promise.all([
          getPlanTasks(project.id), getMilestones(project.id), getPeople(project.id),
        ]);
        const arr  = t || [];
        const calc = arr.length ? recalculatePlan(arr) : arr;
        setTasks(calc); setMilestones(m || []); setPeople(p || []);
        pushHistory(calc);
      } catch (e) { toast.error('Failed to load plan: ' + (e.message || '')); }
      finally { setLoading(false); }
    })();
  }, [project?.id]);

  // ── History helpers ───────────────────────────────────────────────────────────
  function pushHistory(t) {
    if (isUndoRedoRef.current) return;
    historyRef.current = historyRef.current.slice(0, histIdxRef.current + 1);
    historyRef.current.push(JSON.parse(JSON.stringify(t)));
    histIdxRef.current = historyRef.current.length - 1;
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const debouncedSave = useCallback(
    debounce(async (updatedTasks) => {
      try {
        const toSave = updatedTasks
          .filter(t => t.id && !String(t.id).startsWith('temp-'))
          .map(t => ({ ...t, project_id: project.id }));
        if (toSave.length) await bulkUpsertPlanTasks(toSave);
      } catch (e) { toast.error('Save failed: ' + (e.message || '')); }
    }, 900),
    [project?.id]
  );

  // ── Undo / Redo ───────────────────────────────────────────────────────────────
  function undo() {
    if (histIdxRef.current <= 0) { toast('Nothing to undo'); return; }
    histIdxRef.current--;
    isUndoRedoRef.current = true;
    const snap = JSON.parse(JSON.stringify(historyRef.current[histIdxRef.current]));
    setTasks(snap); debouncedSave(snap);
    isUndoRedoRef.current = false;
  }
  function redo() {
    if (histIdxRef.current >= historyRef.current.length - 1) { toast('Nothing to redo'); return; }
    histIdxRef.current++;
    isUndoRedoRef.current = true;
    const snap = JSON.parse(JSON.stringify(historyRef.current[histIdxRef.current]));
    setTasks(snap); debouncedSave(snap);
    isUndoRedoRef.current = false;
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      const ctrl = e.metaKey || e.ctrlKey;

      // Undo / Redo
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

      // When a cell is selected but not editing
      if (selectedCell && !editCell) {
        // Ctrl+C — copy cell
        if (ctrl && e.key === 'c') {
          const task = tasks.find(t => t.id === selectedCell.taskId);
          if (task) {
            const val = task[selectedCell.col] ?? '';
            navigator.clipboard.writeText(String(val)).catch(() => {});
            setCopiedCell({ ...selectedCell, value: val });
            toast.success('Cell copied', { duration: 1200 });
          }
          return;
        }
        // Ctrl+V — paste into selected cell
        if (ctrl && e.key === 'v') {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            if (text !== undefined) handleCellChange(selectedCell.taskId, selectedCell.col, text.trim());
          }).catch(() => {});
          return;
        }
        // Ctrl+B — toggle bold on selected cell
        if (ctrl && e.key === 'b') {
          e.preventDefault();
          handleToggleBold(selectedCell.taskId, selectedCell.col);
          return;
        }
        // Enter / F2 — enter edit mode
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          setEditCell(selectedCell);
          return;
        }
        // Escape — deselect
        if (e.key === 'Escape') {
          setSelectedCell(null); setToolbarPos(null);
        }
        // Delete / Backspace — clear cell
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const col = COLUMNS.find(c => c.key === selectedCell.col);
          if (col && !col.readOnly) handleCellChange(selectedCell.taskId, selectedCell.col, '');
        }
      }
      // Escape while editing — cancel edit
      if (editCell && e.key === 'Escape') {
        setEditCell(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedCell, editCell, tasks]);

  // Close menus on outside click
  useEffect(() => {
    const h = (e) => {
      setOpenMenu(null);
      // Only deselect if click is truly outside the table area
      if (!e.target.closest('[data-plan-table]') && !e.target.closest('[data-format-toolbar]')) {
        setSelectedCell(null); setToolbarPos(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Cell change ───────────────────────────────────────────────────────────────
  const handleCellChange = useCallback((taskId, colKey, value) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const next = [...prev];
      const task = { ...next[idx] };

      if (['planned_start','planned_end','baseline_planned_start','baseline_planned_end','actual_start','current_end'].includes(colKey)) {
        task[colKey] = value || null;
      } else if (colKey === 'duration') {
        task[colKey] = parseInt(value) || 0;
      } else {
        task[colKey] = value;
      }

      // Auto-status
      if (colKey === 'actual_start' && value && (task.status === 'Not Started' || !task.status)) {
        task.status = 'In Progress'; task.planned_start_locked = true;
      }
      if (colKey === 'current_end' && value) { task.status = 'Done'; }

      // Baseline auto-copy
      if (colKey === 'planned_start' && value && !task.baseline_planned_start) {
        task.baseline_planned_start = value; task.baseline_locked = true;
      }
      // Recalc planned_end
      if ((colKey === 'planned_start' || colKey === 'duration') && task.planned_start && task.duration) {
        const pe = calcPlannedEnd(task.planned_start, task.duration);
        if (pe) task.planned_end = typeof pe === 'string' ? pe : pe?.toISOString?.().split('T')[0] ?? pe;
      }
      // Recalc delay
      if (task.planned_end && task.current_end) {
        const delay = networkdays(parseDate(task.planned_end), parseDate(task.current_end));
        task.delay_status = delay > 0 ? 'Delay' : 'On Track';
        task.days_delay = Math.max(0, delay - 1);
      }

      next[idx] = task;
      const final = ['dependency','duration','status','planned_start'].includes(colKey)
        ? recalculatePlan(next) : next;
      pushHistory(final); debouncedSave(final);
      return final;
    });
    setEditCell(null);
  }, [debouncedSave]);

  // ── Formatting helpers ────────────────────────────────────────────────────────
  function getCellFmt(task, colKey) {
    return task?.cell_formatting?.[colKey] || {};
  }

  function applyFormat(taskId, colKey, patch) {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const next = [...prev];
      const task = { ...next[idx] };
      const existing = task.cell_formatting || {};
      task.cell_formatting = {
        ...existing,
        [colKey]: { ...(existing[colKey] || {}), ...patch },
      };
      next[idx] = task;
      pushHistory(next); debouncedSave(next);
      return next;
    });
  }

  function handleToggleBold(taskId, colKey) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const fmt = getCellFmt(task, colKey);
    applyFormat(taskId, colKey, { bold: !fmt.bold });
  }

  function handleSetBgColor(taskId, colKey, color) {
    applyFormat(taskId, colKey, { bgColor: color });
  }

  function handleClearFormat(taskId, colKey) {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const next = [...prev];
      const task = { ...next[idx] };
      const existing = { ...(task.cell_formatting || {}) };
      delete existing[colKey];
      task.cell_formatting = existing;
      next[idx] = task;
      pushHistory(next); debouncedSave(next);
      return next;
    });
  }

  // ── Add / Insert / Delete rows ────────────────────────────────────────────────
  const handleAddRow = async () => {
    try {
      const created = await upsertPlanTask({ project_id: project.id, activities: 'New Activity', status: 'Not Started', duration: 0, sort_order: tasks.length });
      const updated = [...tasks, created];
      setTasks(updated); pushHistory(updated);
      toast.success('Row added');
    } catch (e) { toast.error('Failed to add row: ' + (e.message || '')); }
  };

  const handleInsertRow = async (taskId, position = 'below') => {
    try {
      const idx = tasks.findIndex(t => t.id === taskId);
      const insertAt = position === 'below' ? idx + 1 : idx;
      const created = await upsertPlanTask({ project_id: project.id, activities: 'New Activity', status: 'Not Started', duration: 0, sort_order: insertAt });
      const updated = [...tasks]; updated.splice(insertAt, 0, created);
      const reordered = updated.map((t, i) => ({ ...t, sort_order: i }));
      setTasks(reordered); pushHistory(reordered); setOpenMenu(null);
      toast.success('Row inserted');
    } catch (e) { toast.error('Failed to insert row: ' + (e.message || '')); }
  };

  const handleDeleteRow = async (taskId) => {
    if (!window.confirm('Delete this row?')) return;
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task?.id && !String(task.id).startsWith('temp-')) await deletePlanTask(task.id);
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated); pushHistory(updated); setOpenMenu(null);
      toast.success('Row deleted');
    } catch (e) { toast.error('Failed to delete: ' + (e.message || '')); }
  };

  // ── Paste from Excel ──────────────────────────────────────────────────────────
  const handlePaste = (e) => {
    // If an input is focused, let browser handle it natively
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
    e.preventDefault();
    const rows = e.clipboardData.getData('text/plain').split('\n').filter(r => r.trim());
    if (!rows.length) return;
    const newObjs = rows.map((row, i) => {
      const v = row.split('\t');
      return { project_id: project.id, activities: v[0]||'', tools: v[1]||'', owner: v[2]||'', status: v[3]||'Not Started', duration: parseInt(v[4])||0, sort_order: tasks.length + i };
    });
    const updated = [...tasks, ...newObjs];
    setTasks(updated); pushHistory(updated); debouncedSave(updated);
    toast.success(`${newObjs.length} rows pasted`);
  };

  // ── Editability ───────────────────────────────────────────────────────────────
  const isEditable = (col, task, visualIdx) => {
    if (!canEdit) return false;
    if (col.readOnly) return false;
    if (col.adminOnly) return isProjectAdmin;
    if (col.specialEdit) return isProjectAdmin || (isDM && (visualIdx === 0 || !task.planned_start_locked));
    return isDM;
  };

  // ── Cell click handlers ───────────────────────────────────────────────────────
  const handleCellSingleClick = (e, taskId, colKey, task, visualIdx) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col) return;
    // For dropdowns, go straight to edit on single click
    if (['status', 'owner', 'milestone'].includes(colKey) && isEditable(col, task, visualIdx)) {
      setEditCell({ taskId, col: colKey });
      setSelectedCell(null); setToolbarPos(null);
      return;
    }
    // Select cell and show format toolbar
    setSelectedCell({ taskId, col: colKey });
    setEditCell(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setToolbarPos({ top: rect.top + window.scrollY - 42, left: Math.max(4, rect.left + window.scrollX) });
  };

  const handleCellDoubleClick = (e, taskId, colKey, task, visualIdx) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col || !isEditable(col, task, visualIdx)) return;
    setEditCell({ taskId, col: colKey });
    setSelectedCell(null); setToolbarPos(null);
  };

  // ── Sort ──────────────────────────────────────────────────────────────────────
  const sortedTasks = useMemo(() => {
    if (!sortConfig.col) return tasks;
    return [...tasks].sort((a, b) => {
      const av = a[sortConfig.col] || '', bv = b[sortConfig.col] || '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [tasks, sortConfig]);

  // ── Milestone color map ───────────────────────────────────────────────────────
  const milestoneColorMap = useMemo(() => {
    const map = {}; let idx = 0;
    sortedTasks.forEach(t => {
      const key = t.milestone || '__none__';
      if (!map[key]) { map[key] = MILESTONE_PALETTE[idx % MILESTONE_PALETTE.length]; idx++; }
    });
    return map;
  }, [sortedTasks]);

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const visCols = COLUMNS.filter(c => visibleCols[c.key] !== false);
    const csv = [
      visCols.map(c => c.label),
      ...sortedTasks.map(t => visCols.map(c => t[c.key] ?? '')),
    ].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `${project.name}-plan.csv` }).click();
    toast.success('Exported');
  };

  // ── Render cell viewer ────────────────────────────────────────────────────────
  const renderViewer = (col, task, visualIdx) => {
    const val = task[col.key];
    const fmt = getCellFmt(task, col.key);
    const isSelected = selectedCell?.taskId === task.id && selectedCell?.col === col.key;
    const isCopied   = copiedCell?.taskId === task.id && copiedCell?.col === col.key;

    const wrapStyle = {
      ...(fmt.bgColor ? { backgroundColor: fmt.bgColor } : {}),
    };
    const textCls = [
      'text-xs truncate px-0.5',
      fmt.bold ? 'font-bold' : '',
      isSelected ? 'outline outline-2 outline-blue-500 rounded' : '',
      isCopied   ? 'outline outline-1 outline-dashed outline-blue-400 rounded' : '',
    ].join(' ');

    const clickProps = {
      onClick:    (e) => handleCellSingleClick(e, task.id, col.key, task, visualIdx),
      onDoubleClick: (e) => handleCellDoubleClick(e, task.id, col.key, task, visualIdx),
    };

    if (col.key === 'status') {
      const c = getStatusColor(val);
      return (
        <div {...clickProps} style={wrapStyle} className={`cursor-pointer ${isSelected ? 'outline outline-2 outline-blue-500 rounded' : ''}`}>
          <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{val || 'Not Started'}</div>
        </div>
      );
    }
    if (col.key === 'delay_status') {
      const cls = val === 'Delay' ? 'bg-red-100 text-red-700' : val === 'On Track' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400';
      return <div {...clickProps} style={wrapStyle} className={isSelected ? 'outline outline-2 outline-blue-500 rounded' : ''}><div className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{val || '—'}</div></div>;
    }
    if (col.key === 'days_delay') {
      return (
        <div {...clickProps} style={wrapStyle} className={`text-xs font-medium ${val > 0 ? 'text-red-600' : 'text-gray-400'} ${isSelected ? 'outline outline-2 outline-blue-500 rounded' : ''}`}>
          {val > 0 ? `+${val}d` : '—'}
        </div>
      );
    }
    if (col.type === 'date') {
      const disp = val ? formatDate(typeof val === 'string' ? parseDate(val) : val) : null;
      return (
        <div {...clickProps} style={wrapStyle} className={`${textCls} cursor-pointer`}>
          {disp || <span className="text-gray-300">—</span>}
        </div>
      );
    }
    if (col.key === 'owner') {
      const person = people.find(p => p.id === val);
      return (
        <div {...clickProps} style={wrapStyle} className={`${textCls} cursor-pointer`}>
          {person?.name || val || <span className="text-gray-300">—</span>}
        </div>
      );
    }
    if (col.key === 'milestone') {
      // milestone is rendered separately with color badge — handled in table body
      return null;
    }
    if (col.key === 'tools' && val && val.startsWith('http')) {
      return (
        <div style={wrapStyle} className={isSelected ? 'outline outline-2 outline-blue-500 rounded' : ''}>
          <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs truncate block">{val}</a>
        </div>
      );
    }
    return (
      <div {...clickProps} style={wrapStyle} className={`${textCls} cursor-pointer`}>
        {val ?? <span className="text-gray-300">—</span>}
      </div>
    );
  };

  // ── Render cell editor ────────────────────────────────────────────────────────
  const renderEditor = (col, task) => {
    const val = task[col.key];
    const commit = (v) => handleCellChange(task.id, col.key, v);
    const cls = 'w-full px-1.5 py-0.5 border border-blue-400 rounded text-xs focus:outline-none bg-white';
    if (col.key === 'status') return <select value={val||'Not Started'} onChange={e=>commit(e.target.value)} className={cls} autoFocus onBlur={()=>setEditCell(null)}>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}</select>;
    if (col.key === 'owner')  return <select value={val||''} onChange={e=>commit(e.target.value)} className={cls} autoFocus onBlur={()=>setEditCell(null)}><option value="">—</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>;
    if (col.key === 'milestone') return <select value={val||''} onChange={e=>commit(e.target.value)} className={cls} autoFocus onBlur={()=>setEditCell(null)}><option value="">—</option>{milestones.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>;
    if (col.type === 'date') {
      const dv = val ? formatDateInput(typeof val==='string' ? parseDate(val) : val) : '';
      return <input type="date" value={dv} onChange={e=>commit(e.target.value)} className={cls} autoFocus onBlur={()=>setEditCell(null)} />;
    }
    if (col.type === 'number') return <input type="number" value={val??''} onChange={e=>commit(e.target.value)} className={cls} autoFocus min={0} onBlur={()=>setEditCell(null)} />;
    return <input type="text" value={val??''} onChange={e=>commit(e.target.value)} className={cls} autoFocus onBlur={()=>setEditCell(null)} />;
  };

  // ── Derived state for render ──────────────────────────────────────────────────
  const frozenCols = COLUMNS.filter(c => c.frozen  && visibleCols[c.key] !== false);
  const scrollCols = COLUMNS.filter(c => !c.frozen && visibleCols[c.key] !== false);
  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;

  // Format toolbar state for selected cell
  const selTask  = selectedCell ? tasks.find(t => t.id === selectedCell.taskId) : null;
  const selFmt   = selTask && selectedCell ? getCellFmt(selTask, selectedCell.col) : null;

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading project plan…</div>;

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5">
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"><Undo2 size={15} className="text-slate-600"/></button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"><Redo2 size={15} className="text-slate-600"/></button>
          <div className="w-px h-4 bg-slate-200 mx-1"/>
          <button onClick={()=>setShowColMenu(v=>!v)} className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"><Eye size={13}/> Columns</button>
          <button onClick={handleExport} className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition"><Download size={13}/> Export</button>
        </div>
        <p className="text-xs text-slate-400">{tasks.length} rows · click to select · double-click to edit · Ctrl+C/V to copy-paste</p>
      </div>

      {/* ── Column toggle ── */}
      {showColMenu && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-700">Show / Hide Columns</span>
            <button onClick={()=>setShowColMenu(false)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {COLUMNS.map(c => (
              <label key={c.key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" className="rounded" checked={visibleCols[c.key]!==false} onChange={e=>setVisibleCols(p=>({...p,[c.key]:e.target.checked}))}/>
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-plan-table>
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh]" onPaste={handlePaste}>
          <table className="w-full border-collapse text-xs">
            {/* Header */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8 sticky left-0 z-30 bg-slate-50 border-r border-slate-200 px-2 py-2 text-slate-400 font-medium">#</th>
                {frozenCols.map(c=>(
                  <th key={c.key} style={{minWidth:c.width,width:c.width}} className="sticky left-8 z-30 bg-slate-50 border-r border-slate-200 px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={()=>setSortConfig({col:c.key,dir:sortConfig.col===c.key&&sortConfig.dir==='asc'?'desc':'asc'})}>
                    <div className="flex items-center gap-1">{c.label}<ArrowUpDown size={10} className="opacity-40"/></div>
                  </th>
                ))}
                {scrollCols.map(c=>(
                  <th key={c.key} style={{minWidth:c.width,width:c.width}} className="bg-slate-50 border-r border-slate-200 px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={()=>setSortConfig({col:c.key,dir:sortConfig.col===c.key&&sortConfig.dir==='asc'?'desc':'asc'})}>
                    <div className="flex items-center gap-1">{c.label}<ArrowUpDown size={10} className="opacity-40"/></div>
                  </th>
                ))}
                {isDM && <th className="w-8 bg-slate-50"/>}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {sortedTasks.map((task, visualIdx) => {
                const msKey   = task.milestone || '__none__';
                const msColor = milestoneColorMap[msKey] || MILESTONE_PALETTE[0];
                const prevKey = visualIdx > 0 ? (sortedTasks[visualIdx-1].milestone || '__none__') : null;
                const isNewGroup = visualIdx > 0 && msKey !== prevKey;

                return (
                  <tr key={task.id||visualIdx} className={`border-b border-slate-100 hover:bg-slate-50/40 group ${isNewGroup ? msColor.rowTop : ''}`}>
                    {/* Row # */}
                    <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-2 py-1.5 text-center text-slate-400 font-medium group-hover:bg-slate-50/40">{visualIdx+1}</td>

                    {/* Frozen cells */}
                    {frozenCols.map(c => {
                      const isMsCol = c.key === 'milestone';
                      const fmt = getCellFmt(task, c.key);
                      const isSelected = selectedCell?.taskId === task.id && selectedCell?.col === c.key;
                      return (
                        <td key={c.key} style={{minWidth:c.width,width:c.width,...(fmt.bgColor&&!isMsCol?{backgroundColor:fmt.bgColor}:{})}}
                          className={`sticky left-8 z-10 bg-white border-r border-slate-100 px-2 py-1.5 group-hover:bg-slate-50/40 ${isMsCol?msColor.border:''} ${isSelected&&!isMsCol?'outline-none':''}`}>
                          {editCell?.taskId===task.id && editCell?.col===c.key
                            ? renderEditor(c, task)
                            : isMsCol
                              ? <div
                                  className={`text-xs font-semibold px-1.5 py-0.5 rounded cursor-pointer ${msColor.bg} ${msColor.text} ${isSelected?'outline outline-2 outline-blue-500':''}`}
                                  onClick={e=>handleCellSingleClick(e,task.id,c.key,task,visualIdx)}
                                  onDoubleClick={e=>handleCellDoubleClick(e,task.id,c.key,task,visualIdx)}
                                >
                                  {(()=>{const ms=milestones.find(m=>m.id===task.milestone);return ms?.name||task.milestone||<span className="opacity-40">—</span>;})()}
                                </div>
                              : renderViewer(c, task, visualIdx)}
                        </td>
                      );
                    })}

                    {/* Scrollable cells */}
                    {scrollCols.map(c => {
                      const fmt = getCellFmt(task, c.key);
                      return (
                        <td key={c.key} style={{minWidth:c.width,width:c.width,...(fmt.bgColor?{backgroundColor:fmt.bgColor}:{})}}
                          className="border-r border-slate-100 px-2 py-1.5">
                          {editCell?.taskId===task.id && editCell?.col===c.key
                            ? renderEditor(c, task)
                            : renderViewer(c, task, visualIdx)}
                        </td>
                      );
                    })}

                    {/* Three-dots */}
                    {isDM && (
                      <td className="px-1 py-1.5 relative" onClick={e=>e.stopPropagation()}>
                        <button onClick={e=>{e.stopPropagation();setOpenMenu(openMenu===task.id?null:task.id);}} className="p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition">
                          <MoreVertical size={13} className="text-slate-500"/>
                        </button>
                        {openMenu===task.id && (
                          <div className="absolute right-0 top-7 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[150px] py-1 text-xs">
                            <button onClick={()=>handleInsertRow(task.id,'above')} className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"><ArrowUpToLine size={12}/> Insert row above</button>
                            <button onClick={()=>handleInsertRow(task.id,'below')} className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"><ArrowDownToLine size={12}/> Insert row below</button>
                            <div className="border-t border-slate-100 my-1"/>
                            <button onClick={()=>handleDeleteRow(task.id)} className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 size={12}/> Delete row</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}

              {sortedTasks.length===0 && (
                <tr><td colSpan={frozenCols.length+scrollCols.length+2} className="text-center py-14 text-slate-400">No tasks yet. Click "Add Row" to start.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add row */}
      {isDM && (
        <button onClick={handleAddRow} className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg flex items-center gap-2 text-sm font-medium border border-emerald-200 transition">
          <Plus size={15}/> Add Row
        </button>
      )}

      {/* ── Floating format toolbar (renders outside table to avoid clipping) ── */}
      {selectedCell && selTask && toolbarPos && (
        <div data-format-toolbar
          className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl flex items-center gap-1 px-2 py-1.5"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Bold */}
          <button
            onClick={() => handleToggleBold(selectedCell.taskId, selectedCell.col)}
            title="Bold (Ctrl+B)"
            className={`p-1.5 rounded text-xs font-bold transition ${selFmt?.bold ? 'bg-slate-700 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            <Bold size={13}/>
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5"/>

          {/* BG color swatches */}
          {BG_COLORS.map(c => (
            <button key={c.hex} title={c.label}
              onClick={() => handleSetBgColor(selectedCell.taskId, selectedCell.col, c.hex)}
              className={`w-4 h-4 rounded border transition hover:scale-110 ${selFmt?.bgColor === c.hex ? 'border-blue-500 border-2' : 'border-slate-300'}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}

          {/* Clear format */}
          {(selFmt?.bold || selFmt?.bgColor) && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-0.5"/>
              <button onClick={() => handleClearFormat(selectedCell.taskId, selectedCell.col)}
                title="Clear formatting" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 text-xs transition">
                ✕
              </button>
            </>
          )}

          <div className="w-px h-4 bg-slate-200 mx-0.5"/>

          {/* Copy/Paste indicators */}
          <button onClick={() => {
            const val = selTask[selectedCell.col] ?? '';
            navigator.clipboard.writeText(String(val)).catch(()=>{});
            setCopiedCell({ ...selectedCell, value: val });
            toast.success('Copied', { duration: 1000 });
          }} title="Copy cell (Ctrl+C)" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition">
            <Copy size={12}/>
          </button>
          {copiedCell && (
            <button onClick={() => {
              navigator.clipboard.readText().then(text => {
                handleCellChange(selectedCell.taskId, selectedCell.col, text.trim());
              }).catch(()=>{});
            }} title="Paste (Ctrl+V)" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition">
              <Clipboard size={12}/>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectPlan;
