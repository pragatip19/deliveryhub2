import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, Download, Plus, Trash2, ArrowUpDown, MoreVertical,
  Undo2, Redo2, ArrowDownToLine, ArrowUpToLine, Bold, Copy, Clipboard, Edit2, GripVertical,
  Lock, LockOpen, Link2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import debounce from 'lodash.debounce';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getPlanTasks, bulkUpsertPlanTasks, upsertPlanTask, deletePlanTask,
  getMilestones, getPeople,
} from '../../../lib/supabase';
import { STATUS_OPTIONS, PLAN_TEMPLATE } from '../../../lib/templates';
import { recalculatePlan, recalcAllDatesFromAnchor, getStatusColor } from '../../../lib/calculations';
import { calcPlannedEnd, formatDate, formatDateInput, parseDate } from '../../../lib/workdays';

// ─── Column definitions ────────────────────────────────────────────────────────
const ACTION_COL_W = 48; // px width of the combined action column (drag + menu)
const ROW_NUM_W    = 32; // px width of the leading "#" column

const COLUMNS = [
  { key: 'milestone',              label: 'Milestone',            width: 160, frozen: true,  type: 'milestone' },
  { key: 'activities',             label: 'Activities',           width: 220, frozen: true,  type: 'text' },
  { key: 'tools',                  label: 'Tools',                width: 150, frozen: false, type: 'text' },
  { key: 'owner',                  label: 'Owner',                width: 150, frozen: false, type: 'people' },
  { key: 'status',                 label: 'Status',               width: 130, frozen: false, type: 'status' },
  { key: 'duration',               label: 'Duration',             width: 80,  frozen: false, type: 'number' },
  { key: 'baseline_planned_start', label: 'Baseline Start',       width: 130, frozen: false, type: 'date', readOnly: true },
  { key: 'baseline_planned_end',   label: 'Baseline End',         width: 130, frozen: false, type: 'date', readOnly: true },
  { key: 'planned_start',          label: 'Planned Start',        width: 120, frozen: false, type: 'date', anchorOnly: true },
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
  { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-l-2 border-blue-400',    rowTop: 'border-t-2 border-blue-200',    hex: '#dbeafe' },
  { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-l-2 border-violet-400',  rowTop: 'border-t-2 border-violet-200',  hex: '#ede9fe' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-l-2 border-emerald-400', rowTop: 'border-t-2 border-emerald-200', hex: '#d1fae5' },
  { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-l-2 border-orange-400',  rowTop: 'border-t-2 border-orange-200',  hex: '#ffedd5' },
  { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-l-2 border-pink-400',    rowTop: 'border-t-2 border-pink-200',    hex: '#fce7f3' },
  { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-l-2 border-teal-400',    rowTop: 'border-t-2 border-teal-200',    hex: '#ccfbf1' },
  { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-l-2 border-amber-400',   rowTop: 'border-t-2 border-amber-200',   hex: '#fef3c7' },
  { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-l-2 border-cyan-400',    rowTop: 'border-t-2 border-cyan-200',    hex: '#cffafe' },
];

const ProjectPlan = ({ project, canEdit }) => {
  const { isAdmin: isAdminFn } = useAuth();
  const isProjectAdmin = canEdit && isAdminFn();
  const isDM = canEdit;

  // ─── Side-panel: DM action items (persisted in localStorage per project) ──

  const [tasks, setTasks]               = useState([]);
  const [milestones, setMilestones]     = useState([]);
  const [people, setPeople]             = useState([]);
  const [visibleCols, setVisibleCols]   = useState(() => {
    const init = {}; COLUMNS.forEach(c => { init[c.key] = true; }); return init;
  });
  const [sortConfig, setSortConfig]     = useState({ col: null, dir: 'asc' });
  const [showColMenu, setShowColMenu]   = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);   // { taskId, col }
  const [editCell, setEditCell]         = useState(null);    // { taskId, col }
  const [copiedCell, setCopiedCell]     = useState(null);    // { taskId, col, value }
  const [loading, setLoading]           = useState(true);
  // { taskId, x, y } — portal-rendered dropdown
  const [openMenu, setOpenMenu]         = useState(null);

  // Drag-to-reorder state
  const [dragId, setDragId]             = useState(null);
  const [dragOverId, setDragOverId]     = useState(null);

  // Multi-row selection for bulk delete
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Hyperlink popover state
  const [linkPopover, setLinkPopover] = useState(null); // { taskId, col } or null
  const [linkText, setLinkText]       = useState('');
  const [linkUrl, setLinkUrl]         = useState('');

  // Column resize state — per-key widths, persisted to localStorage
  const [colWidths, setColWidths] = useState(() => {
    const defaults = Object.fromEntries(COLUMNS.map(c => [c.key, c.width]));
    try {
      const saved = localStorage.getItem('planColWidths');
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });
  const resizingRef = useRef(null); // { key, startX, startW }

  // Persist column widths to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('planColWidths', JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  // Global mouse handlers for column resize
  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current) return;
      const { key, startX, startW } = resizingRef.current;
      const newW = Math.max(50, startW + (e.clientX - startX));
      setColWidths(prev => ({ ...prev, [key]: newW }));
    };
    const onUp = () => { resizingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  // Undo/redo
  const historyRef    = useRef([]);
  const histIdxRef    = useRef(-1);
  const isUndoRedoRef = useRef(false);
  // Ref to sortedTasks — used by the keyboard handler (Enter → next row)
  const sortedTasksRef = useRef([]);

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

  // ── History ───────────────────────────────────────────────────────────────────
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
        // Strip computed/derived fields that are not DB columns.
        // baseline_delta does not exist in the project_plan table → PGRST204.
        // Also strip any old field-name aliases that may be stale on task objects.
        const STRIP_KEYS = [
          'baseline_delta',
          'days_delay',
          'delay_status',
          'learnings',           // not yet a DB column
          'no_of_days_delay',
          'delay_on_track',
          'planned_start_vs_baseline',
        ];
        const toSave = updatedTasks
          .filter(t => t.id && !String(t.id).startsWith('temp-'))
          .map(t => {
            const clean = { ...t, project_id: project.id };
            STRIP_KEYS.forEach(k => delete clean[k]);
            return clean;
          });
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
      // Don't intercept shortcuts when the user is typing inside any input/textarea/select
      // (e.g. the hyperlink URL popover, edit cell inputs, etc.)
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.metaKey || e.ctrlKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

      if (selectedCell && !editCell) {
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
        if (ctrl && e.key === 'v') {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            if (text !== undefined) handleCellChange(selectedCell.taskId, selectedCell.col, text.trim());
          }).catch(() => {});
          return;
        }
        if (ctrl && e.key === 'b') {
          e.preventDefault();
          handleToggleBold(selectedCell.taskId, selectedCell.col);
          return;
        }
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          setEditCell(selectedCell);
          return;
        }
        if (e.key === 'Escape') { setSelectedCell(null); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const col = COLUMNS.find(c => c.key === selectedCell.col);
          if (col && !col.readOnly && !col.anchorOnly) handleCellChange(selectedCell.taskId, selectedCell.col, '');
        }
        // Arrow-down / Enter moves selection to next row (same column)
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          const st = sortedTasksRef.current;
          const cur = st.findIndex(t => t.id === selectedCell.taskId);
          if (cur >= 0 && cur < st.length - 1) setSelectedCell({ taskId: st[cur + 1].id, col: selectedCell.col });
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const st = sortedTasksRef.current;
          const cur = st.findIndex(t => t.id === selectedCell.taskId);
          if (cur > 0) setSelectedCell({ taskId: st[cur - 1].id, col: selectedCell.col });
        }
      }
      if (editCell && e.key === 'Escape') { setEditCell(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedCell, editCell, tasks]);

  // Close menus/toolbar on outside click
  useEffect(() => {
    const h = (e) => {
      // Close the portal row-action menu if clicking outside it
      if (!e.target.closest('[data-row-menu]')) setOpenMenu(null);
      if (!e.target.closest('[data-plan-table]') && !e.target.closest('[data-format-toolbar]')) {
        setSelectedCell(null);
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

      // ── ANCHOR planned_start changed → cascade ALL planned + baseline dates ──
      if (colKey === 'planned_start' && prev[idx].sort_order === 0 && value) {
        const cascaded = recalcAllDatesFromAnchor(prev, value);
        pushHistory(cascaded);
        debouncedSave(cascaded);
        return cascaded;
      }

      const next = [...prev];
      const task = { ...next[idx] };

      if (['actual_start','current_end'].includes(colKey)) {
        task[colKey] = value || null;
      } else if (colKey === 'duration') {
        task[colKey] = parseInt(value) || 0;
      } else {
        task[colKey] = value;
      }

      // Auto-status
      if (colKey === 'actual_start' && value && (task.status === 'Not Started' || !task.status)) {
        task.status = 'In Progress';
      }
      if (colKey === 'current_end' && value) { task.status = 'Done'; }
      // NOTE: delay_status and days_delay are NOT recalculated here.
      // They are derived by recalculatePlan → calculateTask → calcDaysDelay,
      // which is called below only when a date-affecting field changes.
      // Editing deviation / deviation_details / learnings must NOT touch delay fields.

      next[idx] = task;

      // ── Activity name changed → auto-update all dependency references ────────
      if (colKey === 'activities' && value !== prev[idx].activities) {
        const oldName = prev[idx].activities || '';
        const withDepsUpdated = next.map(t =>
          t.id !== taskId && t.dependency === oldName ? { ...t, dependency: value } : t
        );
        const final = recalculatePlan(withDepsUpdated);
        pushHistory(final); debouncedSave(final);
        return final;
      }

      // Recalculate the full plan whenever a field that affects downstream
      // tasks changes.  actual_start / current_end are included so that:
      //   (a) the edited row stays in sort_order position (recalculate sorts),
      //   (b) days_delay propagates to all Not-Started tasks immediately.
      const final = ['dependency','duration','status','actual_start','current_end'].includes(colKey)
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
      task.cell_formatting = { ...existing, [colKey]: { ...(existing[colKey] || {}), ...patch } };
      next[idx] = task;
      pushHistory(next); debouncedSave(next);
      return next;
    });
  }

  function handleToggleBold(taskId, colKey) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    applyFormat(taskId, colKey, { bold: !getCellFmt(task, colKey).bold });
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
      setTasks(reordered); pushHistory(reordered); setOpenMenu(null);  // close portal menu
      toast.success('Row inserted');
    } catch (e) { toast.error('Failed to insert row: ' + (e.message || '')); }
  };

  const handleDeleteRow = async (taskId) => {
    if (!window.confirm('Delete this row?')) return;
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task?.id && !String(task.id).startsWith('temp-')) await deletePlanTask(task.id);
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated); pushHistory(updated); setOpenMenu(null);  // close portal menu
      toast.success('Row deleted');
    } catch (e) { toast.error('Failed to delete: ' + (e.message || '')); }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`Delete ${selectedRows.size} selected row${selectedRows.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = [...selectedRows];
      await Promise.all(
        ids
          .filter(id => !String(id).startsWith('temp-'))
          .map(id => deletePlanTask(id))
      );
      const updated = tasks.filter(t => !selectedRows.has(t.id));
      setTasks(updated); pushHistory(updated);
      setSelectedRows(new Set());
      toast.success(`${ids.length} row${ids.length > 1 ? 's' : ''} deleted`);
    } catch (e) { toast.error('Delete failed: ' + (e.message || '')); }
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────────────────
  function handleRowReorder(fromId, toId) {
    if (!fromId || fromId === toId) { setDragId(null); setDragOverId(null); return; }
    setTasks(prev => {
      const fromIdx = prev.findIndex(t => t.id === fromId);
      const toIdx   = prev.findIndex(t => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      const reordered = next.map((t, i) => ({ ...t, sort_order: i }));
      pushHistory(reordered);
      debouncedSave(reordered);
      return reordered;
    });
    setDragId(null);
    setDragOverId(null);
  }

  // ── Load Template ─────────────────────────────────────────────────────────────
  const handleLoadTemplate = async () => {
    if (!window.confirm(`This will replace ALL existing tasks with the ${PLAN_TEMPLATE.length}-task standard template. Continue?`)) return;
    try {
      toast('Loading template…', { duration: 3000 });
      // 1. Fetch + delete all existing tasks one-by-one (RLS-safe — same fn used by the UI Delete button)
      const existing = await getPlanTasks(project.id);
      if (existing.length > 0) {
        await Promise.all(existing.map(t => deletePlanTask(t.id)));
      }
      // 2. Insert template tasks with deterministic sort_order 0 → N-1
      const toInsert = PLAN_TEMPLATE.map((t, i) => ({
        project_id: project.id,
        milestone:  t.milestone,
        activities: t.activities,
        tools:      t.tools,
        duration:   t.duration,
        dependency: t.dependency,
        status:     'Not Started',
        sort_order: i,
      }));
      await bulkUpsertPlanTasks(toInsert);
      // 3. Re-fetch ordered by sort_order (upsert response order is not guaranteed)
      const fresh = await getPlanTasks(project.id);
      setTasks(fresh);
      pushHistory(fresh);
      toast.success(`${PLAN_TEMPLATE.length} tasks loaded in correct order`);
    } catch (e) {
      toast.error('Failed to load template: ' + (e.message || ''));
    }
  };

  // ── Lock / Unlock Baseline ────────────────────────────────────────────────────
  const isBaselineLocked = tasks.length > 0 && tasks.every(t => t.baseline_locked === true);

  const handleLockBaseline = () => {
    if (!window.confirm('Lock baseline? Current planned dates will be frozen as the baseline. Future anchor changes will only update planned dates, not baseline.')) return;
    const locked = tasks.map(t => ({
      ...t,
      baseline_planned_start: t.planned_start || t.baseline_planned_start,
      baseline_planned_end:   t.planned_end   || t.baseline_planned_end,
      baseline_locked:        true,
    }));
    setTasks(locked); pushHistory(locked); debouncedSave(locked);
    toast.success('Baseline locked');
  };

  const handleUnlockBaseline = () => {
    if (!window.confirm('Unlock baseline? It will be overwritten the next time the anchor date is changed.')) return;
    const unlocked = tasks.map(t => ({ ...t, baseline_locked: false }));
    setTasks(unlocked); pushHistory(unlocked); debouncedSave(unlocked);
    toast('Baseline unlocked');
  };

  // ── Paste rows from Excel ─────────────────────────────────────────────────────
  const handlePaste = (e) => {
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
  const isEditable = (col, task) => {
    if (!canEdit) return false;
    if (col.readOnly) return false;
    // planned_start: admin OR DM, but only for the anchor task (sort_order 0)
    if (col.anchorOnly) return isDM && (task.sort_order === 0);
    return isDM;
  };

  // ── Cell click handlers ───────────────────────────────────────────────────────
  const handleCellSingleClick = (e, taskId, colKey, task) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col) return;
    if (isEditable(col, task)) {
      // All editable cells (dropdowns, text, number, date) go straight to edit
      // mode on a single click so the user can paste/type immediately.
      setEditCell({ taskId, col: colKey });
      setSelectedCell({ taskId, col: colKey }); // keep selected for format toolbar
      return;
    }
    // Non-editable: just select (highlights cell, shows format toolbar)
    setSelectedCell({ taskId, col: colKey });
    setEditCell(null);
  };

  const handleCellDoubleClick = (e, taskId, colKey, task) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col || !isEditable(col, task)) return;
    setEditCell({ taskId, col: colKey });
    setSelectedCell(null);
  };

  // ── Sort ──────────────────────────────────────────────────────────────────────
  // Default: always sort by sort_order (the user's defined row sequence).
  // Column-header sort is a temporary view — sort_order is the tiebreaker.
  const sortedTasks = useMemo(() => {
    if (!sortConfig.col) {
      return [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return [...tasks].sort((a, b) => {
      const av = a[sortConfig.col] ?? '', bv = b[sortConfig.col] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      const primary = sortConfig.dir === 'asc' ? cmp : -cmp;
      // sort_order as tiebreaker so equal-value rows stay in defined sequence
      return primary !== 0 ? primary : (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [tasks, sortConfig]);

  // Keep ref in sync so keyboard Enter-navigation can read latest sortedTasks
  useEffect(() => { sortedTasksRef.current = sortedTasks; }, [sortedTasks]);

  // ── Milestone color map ───────────────────────────────────────────────────────
  const milestoneColorMap = useMemo(() => {
    const map = {}; let idx = 0;
    sortedTasks.forEach(t => {
      const key = t.milestone || '__none__';
      if (!map[key]) { map[key] = MILESTONE_PALETTE[idx % MILESTONE_PALETTE.length]; idx++; }
    });
    return map;
  }, [sortedTasks]);

  // ── Frozen column left offsets (cumulative) ───────────────────────────────────
  const frozenCols = COLUMNS.filter(c => c.frozen  && visibleCols[c.key] !== false);
  const scrollCols = COLUMNS.filter(c => !c.frozen && visibleCols[c.key] !== false);

  const frozenLeftOffsets = useMemo(() => {
    const offsets = {};
    let left = ACTION_COL_W + ROW_NUM_W; // 48 (action col) + 32 (row#) = 80
    frozenCols.forEach(c => { offsets[c.key] = left; left += (colWidths[c.key] ?? c.width); });
    return offsets;
  }, [frozenCols, colWidths]);

  // Total pixel width of the table — used with table-layout:fixed so the browser
  // respects exact column widths rather than recalculating them automatically.
  const totalTableWidth = useMemo(() => {
    const allVis = COLUMNS.filter(c => visibleCols[c.key] !== false);
    return ACTION_COL_W + ROW_NUM_W + allVis.reduce((s, c) => s + (colWidths[c.key] ?? c.width), 0);
  }, [visibleCols, colWidths]);

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

    const wrapStyle = fmt.bgColor ? { backgroundColor: fmt.bgColor } : {};
    const textCls = [
      'text-xs truncate px-0.5',
      fmt.bold ? 'font-bold' : '',
      isSelected ? 'outline outline-2 outline-blue-500 rounded' : '',
      isCopied   ? 'outline outline-1 outline-dashed outline-blue-400 rounded' : '',
    ].join(' ');

    const clickProps = {
      onClick:       (e) => handleCellSingleClick(e, task.id, col.key, task),
      onDoubleClick: (e) => handleCellDoubleClick(e, task.id, col.key, task),
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
    if (col.key === 'milestone') return null; // rendered separately with color badge

    // Detect [Display Text](url) markdown link format — works in ANY column
    if (typeof val === 'string' && val) {
      const mdLink = val.match(/^\[(.+?)\]\((.+?)\)$/);
      if (mdLink) {
        const [, displayText, rawHref] = mdLink;
        const href = /^https?:\/\//i.test(rawHref) ? rawHref : `https://${rawHref}`;
        return (
          <div style={wrapStyle}
            className={`flex items-center ${isSelected ? 'outline outline-2 outline-blue-500 rounded' : ''}`}
            {...clickProps}>
            {/* Wrap both icon AND text in the <a> so clicking anywhere on the link opens it */}
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 min-w-0"
              onClick={e => e.stopPropagation()} title={href}>
              <Link2 size={12} className="flex-shrink-0" />
              <span className="text-xs underline truncate">{displayText}</span>
            </a>
          </div>
        );
      }
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

    // Enter key → commit and move selection to next row (Google Sheets behaviour)
    const onEnterKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        setEditCell(null);
        const st  = sortedTasksRef.current;
        const idx = st.findIndex(t => t.id === task.id);
        if (idx >= 0 && idx < st.length - 1) setSelectedCell({ taskId: st[idx + 1].id, col: col.key });
      }
    };

    if (col.key === 'status')    return <select value={val||'Not Started'} onChange={e=>commit(e.target.value)} onKeyDown={onEnterKey} className={cls} autoFocus onBlur={()=>setEditCell(null)}>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}</select>;
    if (col.key === 'owner')     return <select value={val||''} onChange={e=>commit(e.target.value)} onKeyDown={onEnterKey} className={cls} autoFocus onBlur={()=>setEditCell(null)}><option value="">—</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>;
    if (col.key === 'milestone') return <select value={val||''} onChange={e=>commit(e.target.value)} onKeyDown={onEnterKey} className={cls} autoFocus onBlur={()=>setEditCell(null)}><option value="">—</option>{milestones.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>;
    if (col.type === 'date') {
      const dv = val ? formatDateInput(typeof val==='string' ? parseDate(val) : val) : '';
      // Use defaultValue (uncontrolled) + commit only on blur — NOT on onChange.
      // onChange fires on every field change (day/month/year individually) in date inputs,
      // which would commit an intermediate value and close the editor before the user finishes.
      const onDateBlur = (e) => {
        if (e.target.value) commit(e.target.value);
        else setEditCell(null);
      };
      const onDateEnter = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation();
          const v = e.target.value;
          if (v) commit(v); else setEditCell(null);
          const st = sortedTasksRef.current;
          const idx = st.findIndex(t => t.id === task.id);
          if (idx >= 0 && idx < st.length - 1) setSelectedCell({ taskId: st[idx + 1].id, col: col.key });
        }
      };
      return <input type="date" defaultValue={dv} onBlur={onDateBlur} onKeyDown={onDateEnter} className={cls} autoFocus />;
    }
    // Number + text inputs: UNCONTROLLED (defaultValue) so that handleCellChange
    // is NOT called on every keystroke — prevents recalculation/re-render/scroll-jump
    // while the user is still typing.  Commit fires only on blur or Enter.
    {
      const origVal = String(val ?? '');
      // Mutable flag shared between both closures — set to true by Escape so
      // that the blur which fires when the input unmounts does NOT commit.
      const skipCommit = { current: false };

      const onCommitBlur = (e) => {
        if (skipCommit.current) return;
        const newVal = e.target.value;
        if (newVal !== origVal) commit(newVal); else setEditCell(null);
      };
      const onCommitKeyDown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation();
          e.target.blur();   // triggers onCommitBlur → commit if value changed
          const st  = sortedTasksRef.current;
          const idx = st.findIndex(t => t.id === task.id);
          if (idx >= 0 && idx < st.length - 1) setSelectedCell({ taskId: st[idx + 1].id, col: col.key });
        } else if (e.key === 'Escape') {
          skipCommit.current = true;
          setEditCell(null);
        }
      };

      if (col.type === 'number') return <input type="number" defaultValue={origVal} onBlur={onCommitBlur} onKeyDown={onCommitKeyDown} className={cls} autoFocus min={0} />;
      return <input type="text" defaultValue={origVal} onBlur={onCommitBlur} onKeyDown={onCommitKeyDown} className={cls} autoFocus />;
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;
  const selTask = selectedCell ? tasks.find(t => t.id === selectedCell.taskId) : null;
  const selFmt  = selTask && selectedCell ? getCellFmt(selTask, selectedCell.col) : null;

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading project plan…</div>;

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm" data-format-toolbar>
        {/* Row 1: main actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"><Undo2 size={15} className="text-slate-600"/></button>
            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"><Redo2 size={15} className="text-slate-600"/></button>
            <div className="w-px h-4 bg-slate-200 mx-1"/>
            <button onClick={()=>setShowColMenu(v=>!v)} className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"><Eye size={13}/> Columns</button>
            <button onClick={handleExport} className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition"><Download size={13}/> Export</button>
            {isDM && (
              <button onClick={handleLoadTemplate} className="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg flex items-center gap-1.5 border border-purple-200 transition">
                <ArrowDownToLine size={13}/> Load Template
              </button>
            )}
            {isDM && tasks.length > 0 && (
              isBaselineLocked
                ? <button onClick={handleUnlockBaseline} title="Baseline is locked — click to unlock" className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg flex items-center gap-1.5 border border-amber-200 transition">
                    <LockOpen size={13}/> Unlock Baseline
                  </button>
                : <button onClick={handleLockBaseline} title="Freeze current planned dates as baseline" className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 border border-emerald-200 transition">
                    <Lock size={13}/> Lock Baseline
                  </button>
            )}
          </div>
          {selectedRows.size > 0 ? (
            <button onClick={handleBulkDelete}
              className="px-2.5 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded-lg flex items-center gap-1.5 border border-red-200 transition font-medium">
              <Trash2 size={13}/> Delete {selectedRows.size} row{selectedRows.size > 1 ? 's' : ''}
            </button>
          ) : (
            <p className="text-xs text-slate-400 hidden md:block">{tasks.length} rows · click=edit · drag grip=reorder</p>
          )}
        </div>

        {/* Row 2: format toolbar — visible only when a cell is selected */}
        {selectedCell && selTask && (
          <div className="flex items-center gap-1 px-4 py-1.5 border-t border-slate-100 bg-slate-50/60">
            <span className="text-[10px] text-slate-400 mr-1 font-medium uppercase tracking-wide">Format:</span>

            {/* Edit cell */}
            {isEditable(COLUMNS.find(c => c.key === selectedCell.col) || {}, selTask) && (
              <button
                onClick={() => { setEditCell(selectedCell); setSelectedCell(null); }}
                title="Edit cell (double-click or Enter)"
                className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition"
              >
                <Edit2 size={13}/>
              </button>
            )}

            <div className="w-px h-4 bg-slate-200 mx-0.5"/>

            {/* Bold */}
            <button
              onClick={() => handleToggleBold(selectedCell.taskId, selectedCell.col)}
              title="Bold (Ctrl+B)"
              className={`p-1.5 rounded transition ${selFmt?.bold ? 'bg-slate-700 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
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

            {/* Copy */}
            <button onClick={() => {
              const val = selTask[selectedCell.col] ?? '';
              navigator.clipboard.writeText(String(val)).catch(() => {});
              setCopiedCell({ ...selectedCell, value: val });
              toast.success('Copied', { duration: 1000 });
            }} title="Copy cell (Ctrl+C)" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition">
              <Copy size={12}/>
            </button>

            {/* Paste */}
            {copiedCell && (
              <button onClick={() => {
                navigator.clipboard.readText().then(text => {
                  handleCellChange(selectedCell.taskId, selectedCell.col, text.trim());
                }).catch(() => {});
              }} title="Paste (Ctrl+V)" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition">
                <Clipboard size={12}/>
              </button>
            )}

            <div className="w-px h-4 bg-slate-200 mx-0.5"/>

            {/* Hyperlink */}
            {isEditable(COLUMNS.find(c => c.key === selectedCell.col) || {}, selTask) && (
              <button
                onClick={() => {
                  const val = selTask[selectedCell.col] ?? '';
                  const match = typeof val === 'string' ? val.match(/^\[(.+?)\]\((.+?)\)$/) : null;
                  setLinkText(match ? match[1] : String(val));
                  setLinkUrl(match ? match[2] : '');
                  setLinkPopover(linkPopover ? null : { taskId: selectedCell.taskId, col: selectedCell.col });
                }}
                title="Add / edit hyperlink"
                className={`p-1.5 rounded transition ${linkPopover?.taskId === selectedCell.taskId && linkPopover?.col === selectedCell.col ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <Link2 size={13}/>
              </button>
            )}

            <div className="w-px h-4 bg-slate-200 mx-0.5 ml-auto"/>
            <span className="text-[10px] text-slate-400">
              {COLUMNS.find(c => c.key === selectedCell.col)?.label} · row {(sortedTasks.findIndex(t => t.id === selectedCell.taskId) + 1) || '?'}
            </span>
          </div>
        )}

        {/* Hyperlink popover — row 3, shown when link button is active */}
        {linkPopover && selectedCell && linkPopover.taskId === selectedCell.taskId && linkPopover.col === selectedCell.col && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100 bg-white">
            <Link2 size={12} className="text-blue-500 flex-shrink-0"/>
            <input
              type="text"
              value={linkText}
              onChange={e => setLinkText(e.target.value)}
              placeholder="Display text"
              className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-36 flex-shrink-0"
            />
            <input
              type="text"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1 min-w-0"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const url = linkUrl.trim() ? (/^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`) : '';
                  if (url) {
                    const text = linkText.trim() || url;
                    handleCellChange(linkPopover.taskId, linkPopover.col, `[${text}](${url})`);
                  }
                  setLinkPopover(null);
                }
                if (e.key === 'Escape') setLinkPopover(null);
              }}
              autoFocus
            />
            <button
              onClick={() => {
                const url = linkUrl.trim() ? (/^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`) : '';
                if (url) {
                  const text = linkText.trim() || url;
                  handleCellChange(linkPopover.taskId, linkPopover.col, `[${text}](${url})`);
                }
                setLinkPopover(null);
              }}
              className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition flex-shrink-0"
            >Apply</button>
            <button onClick={() => setLinkPopover(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition flex-shrink-0">
              <X size={12}/>
            </button>
          </div>
        )}
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
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }} onPaste={handlePaste}>
          {/* table-layout:fixed + explicit totalTableWidth means column widths are respected exactly,
              making the resize handle dragging work correctly. */}
          <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: totalTableWidth }}>
            <colgroup>
              <col style={{ width: ACTION_COL_W }} />
              <col style={{ width: ROW_NUM_W }} />
              {frozenCols.map(c => <col key={c.key} style={{ width: colWidths[c.key] ?? c.width }} />)}
              {scrollCols.map(c => <col key={c.key} style={{ width: colWidths[c.key] ?? c.width }} />)}
            </colgroup>
            {/* Header */}
            <thead className="sticky top-0 z-20" style={{ backgroundColor: '#f8fafc' }}>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                {/* Combined action col: drag handle + row menu + select-all checkbox */}
                <th className="sticky z-30 border-r border-slate-200" style={{ left: 0, width: ACTION_COL_W, minWidth: ACTION_COL_W, backgroundColor: '#f8fafc' }}>
                  {isDM && (
                    <div className="flex items-center justify-center h-full">
                      <input type="checkbox" title="Select all"
                        checked={sortedTasks.length > 0 && sortedTasks.every(t => selectedRows.has(t.id))}
                        onChange={e => {
                          if (e.target.checked) setSelectedRows(new Set(sortedTasks.map(t => t.id)));
                          else setSelectedRows(new Set());
                        }}
                        className="w-3 h-3 rounded cursor-pointer"
                      />
                    </div>
                  )}
                </th>
                {/* Row # */}
                <th className="sticky z-30 border-r border-slate-200 px-2 py-2 text-slate-400 font-medium" style={{ left: ACTION_COL_W, width: ROW_NUM_W, minWidth: ROW_NUM_W, backgroundColor: '#f8fafc' }}>#</th>
                {/* Frozen cols */}
                {frozenCols.map(c => {
                  const w = colWidths[c.key] ?? c.width;
                  return (
                    <th key={c.key}
                      style={{ minWidth: w, width: w, left: frozenLeftOffsets[c.key], backgroundColor: '#f8fafc', padding: 0 }}
                      className="sticky z-30 border-r border-b border-slate-200 whitespace-nowrap">
                      {/* Flex layout: label area + resize strip as siblings — no absolute positioning needed */}
                      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 36 }}>
                        <div
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', cursor: 'pointer', userSelect: 'none', overflow: 'hidden' }}
                          className="font-semibold text-slate-600 text-xs text-left"
                          onClick={() => setSortConfig({ col: c.key, dir: sortConfig.col === c.key && sortConfig.dir === 'asc' ? 'desc' : 'asc' })}>
                          <span className="truncate">{c.label}</span>
                          <ArrowUpDown size={10} className="opacity-40 flex-shrink-0"/>
                        </div>
                        {/* Resize strip — stretches full height via alignSelf: stretch (inherits from parent align-items: stretch) */}
                        <div
                          style={{ width: 6, flexShrink: 0, cursor: 'col-resize' }}
                          className="hover:bg-blue-400 opacity-0 hover:opacity-60 transition-opacity"
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { key: c.key, startX: e.clientX, startW: w }; }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </th>
                  );
                })}
                {/* Scrollable cols */}
                {scrollCols.map(c => {
                  const w = colWidths[c.key] ?? c.width;
                  return (
                    <th key={c.key}
                      style={{ minWidth: w, width: w, backgroundColor: '#f8fafc', padding: 0 }}
                      className="border-r border-b border-slate-200 whitespace-nowrap">
                      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 36 }}>
                        <div
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', cursor: 'pointer', userSelect: 'none', overflow: 'hidden' }}
                          className="font-semibold text-slate-600 text-xs text-left"
                          onClick={() => setSortConfig({ col: c.key, dir: sortConfig.col === c.key && sortConfig.dir === 'asc' ? 'desc' : 'asc' })}>
                          <span className="truncate">{c.label}</span>
                          <ArrowUpDown size={10} className="opacity-40 flex-shrink-0"/>
                        </div>
                        <div
                          style={{ width: 6, flexShrink: 0, cursor: 'col-resize' }}
                          className="hover:bg-blue-400 opacity-0 hover:opacity-60 transition-opacity"
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { key: c.key, startX: e.clientX, startW: w }; }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {sortedTasks.map((task, visualIdx) => {
                const msKey    = task.milestone || '__none__';
                const msColor  = milestoneColorMap[msKey] || MILESTONE_PALETTE[0];
                const prevKey  = visualIdx > 0 ? (sortedTasks[visualIdx-1].milestone || '__none__') : null;
                const isNewGroup  = visualIdx > 0 && msKey !== prevKey;
                const isDragging  = dragId === task.id;
                const isDragOver  = dragOverId === task.id;

                return (
                  <tr key={task.id||visualIdx}
                    draggable={isDM && editCell?.taskId !== task.id}
                    onDragStart={e => {
                      // Only allow drag when the mousedown originated from the grip handle
                      if (!e.target.closest('[data-drag-handle]')) { e.preventDefault(); return; }
                      setDragId(task.id);
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOverId(task.id); }}
                    onDrop={e => { e.preventDefault(); handleRowReorder(dragId, task.id); }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    className={[
                      'border-b border-slate-100 group transition-colors',
                      isNewGroup    ? msColor.rowTop  : '',
                      isDragging    ? 'opacity-40'    : 'hover:bg-slate-50/40',
                      isDragOver    ? 'border-t-2 border-blue-400 bg-blue-50/30' : '',
                    ].join(' ')}>

                    {/* Combined action col: checkbox + drag handle + row menu (left side) */}
                    <td className="sticky z-10 border-r border-slate-100"
                      style={{ left: 0, width: ACTION_COL_W, minWidth: ACTION_COL_W, backgroundColor: '#ffffff' }}
                      onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-1 py-1.5 gap-0.5">
                        {isDM && (
                          <input type="checkbox"
                            checked={selectedRows.has(task.id)}
                            onChange={e => {
                              const next = new Set(selectedRows);
                              if (e.target.checked) next.add(task.id); else next.delete(task.id);
                              setSelectedRows(next);
                            }}
                            className="w-3 h-3 rounded cursor-pointer flex-shrink-0"
                          />
                        )}
                        {isDM && (
                          <div data-drag-handle className="flex items-center">
                            <GripVertical size={12} className="text-slate-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition flex-shrink-0"/>
                          </div>
                        )}
                        {isDM && (
                          <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenu?.taskId === task.id) { setOpenMenu(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setOpenMenu({ taskId: task.id, x: rect.left, y: rect.bottom + 4 });
                            }}
                            className="p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition">
                            <MoreVertical size={12} className="text-slate-500"/>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Row # */}
                    <td className="sticky z-10 border-r border-slate-100 px-2 py-1.5 text-center text-slate-400 font-medium"
                      style={{ left: ACTION_COL_W, width: ROW_NUM_W, minWidth: ROW_NUM_W, backgroundColor: '#ffffff' }}>
                      {visualIdx + 1}
                    </td>

                    {/* Frozen cells */}
                    {frozenCols.map(c => {
                      const isMsCol = c.key === 'milestone';
                      const fmt = getCellFmt(task, c.key);
                      const isSelected = selectedCell?.taskId === task.id && selectedCell?.col === c.key;
                      return (
                        <td key={c.key}
                          style={{ minWidth: colWidths[c.key] ?? c.width, width: colWidths[c.key] ?? c.width, left: frozenLeftOffsets[c.key], backgroundColor: fmt.bgColor || (isMsCol && task.milestone ? msColor.hex : '#ffffff') }}
                          className={`sticky z-10 border-r border-slate-100 px-2 py-1.5 ${isMsCol ? msColor.border : ''}`}>
                          {editCell?.taskId === task.id && editCell?.col === c.key
                            ? renderEditor(c, task)
                            : isMsCol
                              ? <div
                                  className={`text-xs font-semibold px-1.5 py-0.5 rounded cursor-pointer ${msColor.bg} ${msColor.text} ${isSelected ? 'outline outline-2 outline-blue-500' : ''}`}
                                  onClick={e => handleCellSingleClick(e, task.id, c.key, task, visualIdx)}
                                  onDoubleClick={e => handleCellDoubleClick(e, task.id, c.key, task, visualIdx)}
                                >
                                  {(()=>{ const ms = milestones.find(m => m.id === task.milestone); return ms?.name || task.milestone || <span className="opacity-40">—</span>; })()}
                                </div>
                              : renderViewer(c, task, visualIdx)}
                        </td>
                      );
                    })}

                    {/* Scrollable cells */}
                    {scrollCols.map(c => {
                      const fmt = getCellFmt(task, c.key);
                      return (
                        <td key={c.key}
                          style={{ minWidth: colWidths[c.key] ?? c.width, width: colWidths[c.key] ?? c.width, backgroundColor: fmt.bgColor || '#ffffff' }}
                          className="border-r border-slate-100 px-2 py-1.5">
                          {editCell?.taskId === task.id && editCell?.col === c.key
                            ? renderEditor(c, task)
                            : renderViewer(c, task, visualIdx)}
                        </td>
                      );
                    })}

                  </tr>
                );
              })}

              {sortedTasks.length === 0 && (
                <tr>
                  <td colSpan={frozenCols.length + scrollCols.length + 2} className="text-center py-14 text-slate-400">
                    No tasks yet — click <strong>Load Template</strong> to start from the standard plan, or <strong>Add Row</strong> to build manually.
                  </td>
                </tr>
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

      {/* ── Row action menu — rendered as a portal so it escapes sticky z-index stacking contexts ── */}
      {openMenu && createPortal(
        <div
          data-row-menu
          style={{ position: 'fixed', top: openMenu.y, left: openMenu.x, zIndex: 99999 }}
          className="bg-white border border-slate-200 rounded-lg shadow-2xl min-w-[160px] py-1 text-xs"
          onMouseDown={e => e.stopPropagation()}
        >
          <button onClick={() => handleInsertRow(openMenu.taskId, 'above')} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <ArrowUpToLine size={12}/> Insert row above
          </button>
          <button onClick={() => handleInsertRow(openMenu.taskId, 'below')} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <ArrowDownToLine size={12}/> Insert row below
          </button>
          <div className="border-t border-slate-100 my-1"/>
          <button onClick={() => handleDeleteRow(openMenu.taskId)} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2">
            <Trash2 size={12}/> Delete row
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProjectPlan;
