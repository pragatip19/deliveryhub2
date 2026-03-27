import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  MoreVertical,
  RefreshCw,
  GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMilestones,
  upsertMilestone,
  deleteMilestone,
  bulkUpsertMilestones,
  getPlanTasks,
} from '../../../lib/supabase';
import { formatDate, getWeekNumber } from '../../../lib/workdays';
import { recalculatePlan } from '../../../lib/calculations';

// ─── Milestone colour palette (matches ProjectPlan badge palette) ──────────
const MILESTONE_COLORS = [
  { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4' }, // teal
  { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' }, // blue
  { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' }, // pink
  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }, // amber
  { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' }, // violet
  { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' }, // green
  { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' }, // red
  { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' }, // orange
];

// Auto-derive milestone status from its tasks
function deriveMilestoneStatus(tasks) {
  if (!tasks.length) return null; // no tasks → keep manual status
  const st = tasks.map(t => t.status);
  if (st.every(s => s === 'Done' || s === 'Not Applicable')) return 'Done';
  if (st.some(s => s === 'Blocked')) return 'Blocked';
  if (st.some(s => s === 'In Progress')) return 'In Progress';
  if (st.some(s => s === 'Done')) return 'In Progress'; // partial
  return 'Not Started';
}

// ─── Default column widths (px) ────────────────────────────────────────────
const COL_DEFAULTS = { num: 32, name: 160, status: 100, start: 84, end: 84 };
const ROW_HEIGHT_DEFAULT = 36; // px
const WEEK_COL_DEFAULT = 52;   // px — small enough that all weeks fit without scrolling
const LS_COL_KEY  = 'msColWidths';
const LS_ROW_KEY  = 'msRowHeight';
const LS_WEEK_KEY = 'msWeekColWidth';

function loadColWidths() {
  try {
    const saved = localStorage.getItem(LS_COL_KEY);
    if (saved) return { ...COL_DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return { ...COL_DEFAULTS };
}
function loadRowHeight() {
  try {
    const saved = localStorage.getItem(LS_ROW_KEY);
    if (saved) return Math.max(32, Number(saved));
  } catch {}
  return ROW_HEIGHT_DEFAULT;
}
function loadWeekColWidth() {
  try {
    const saved = localStorage.getItem(LS_WEEK_KEY);
    if (saved) return Math.max(50, Number(saved));
  } catch {}
  return WEEK_COL_DEFAULT;
}

const MilestonesTab = ({ project, canEdit }) => {
  const [milestones, setMilestones]     = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [editingName, setEditingName]   = useState('');
  const [selectedId, setSelectedId]     = useState(null); // first-click selection
  const [openMenuId, setOpenMenuId]     = useState(null); // 3-dot menu state

  // Resize state
  const [colWidths, setColWidths]       = useState(loadColWidths);
  const [rowHeight, setRowHeight]       = useState(loadRowHeight);
  const [weekColWidth, setWeekColWidth] = useState(loadWeekColWidth);

  const resizingColRef  = useRef(null); // { key, startX, startW }
  const resizingRowRef  = useRef(null); // { startY, startH }
  const resizingWeekRef = useRef(null); // { startX, startW }

  // Drag-and-drop row reordering
  const [dragIndex, setDragIndex]   = useState(null); // index being dragged
  const [dragOver, setDragOver]     = useState(null); // index being hovered over
  const dragNodeRef                 = useRef(null);   // ghost element

  // Persist resize to localStorage
  useEffect(() => {
    try { localStorage.setItem(LS_COL_KEY,  JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  useEffect(() => {
    try { localStorage.setItem(LS_ROW_KEY,  String(rowHeight)); } catch {}
  }, [rowHeight]);
  useEffect(() => {
    try { localStorage.setItem(LS_WEEK_KEY, String(weekColWidth)); } catch {}
  }, [weekColWidth]);

  // Global mouse handlers for resize drag
  useEffect(() => {
    const onMove = (e) => {
      if (resizingColRef.current) {
        const { key, startX, startW } = resizingColRef.current;
        const newW = Math.max(50, startW + (e.clientX - startX));
        setColWidths((prev) => ({ ...prev, [key]: newW }));
      }
      if (resizingRowRef.current) {
        const { startY, startH } = resizingRowRef.current;
        const newH = Math.max(32, startH + (e.clientY - startY));
        setRowHeight(newH);
      }
      if (resizingWeekRef.current) {
        const { startX, startW } = resizingWeekRef.current;
        const newW = Math.max(50, startW + (e.clientX - startX));
        setWeekColWidth(newW);
      }
    };
    const onUp = () => {
      resizingColRef.current  = null;
      resizingRowRef.current  = null;
      resizingWeekRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  // ─── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [milestonesData, tasksData] = await Promise.all([
          getMilestones(project.id),
          getPlanTasks(project.id),
        ]);
        setMilestones(milestonesData);
        // Recalculate so planned_start/end reflect cascaded delays
        const calcTasks = tasksData?.length ? recalculatePlan(tasksData) : (tasksData || []);
        setTasks(calcTasks);
      } catch (error) {
        console.error('Failed to load milestones:', error);
        toast.error('Failed to load milestones');
      } finally {
        setLoading(false);
      }
    };
    if (project?.id) loadData();
  }, [project?.id]);

  // ─── Compute milestone date ranges + derived status from plan tasks ───────
  const milestonesWithDates = useMemo(() => {
    return milestones.map((milestone, idx) => {
      // Match tasks by milestone UUID (id) OR by name string (template projects)
      const relatedTasks = tasks.filter(
        (t) => t.milestone === milestone.id || t.milestone === milestone.name
      );
      const color = MILESTONE_COLORS[idx % MILESTONE_COLORS.length];
      if (!relatedTasks.length) return { ...milestone, color };

      const starts = relatedTasks.map((t) => new Date(t.planned_start)).filter((d) => !isNaN(d));
      const ends   = relatedTasks.map((t) => new Date(t.planned_end)).filter((d) => !isNaN(d));
      const derived = deriveMilestoneStatus(relatedTasks);

      return {
        ...milestone,
        color,
        start_date:    starts.length ? new Date(Math.min(...starts.map(d => d.getTime()))) : milestone.start_date,
        end_date:      ends.length   ? new Date(Math.max(...ends.map(d => d.getTime())))   : milestone.end_date,
        derivedStatus: derived,
      };
    });
  }, [milestones, tasks]);

  // ─── Gantt date range ─────────────────────────────────────────────────────
  const { monthsRange, minDate, maxDate } = useMemo(() => {
    const dates = milestonesWithDates
      .flatMap((m) => [m.start_date && new Date(m.start_date), m.end_date && new Date(m.end_date)])
      .filter((d) => d && !isNaN(d.getTime()));

    if (!dates.length) {
      const now = new Date();
      return { monthsRange: [], minDate: now, maxDate: now };
    }

    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    max.setMonth(max.getMonth() + 1);

    const months = [];
    let cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) {
      months.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return { monthsRange: months, minDate: min, maxDate: max };
  }, [milestonesWithDates]);

  const weeks = useMemo(() => {
    if (!monthsRange.length) return [];
    const list = [];
    let cur = new Date(minDate);
    cur.setDate(cur.getDate() - cur.getDay());
    while (cur <= maxDate) {
      list.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return list;
  }, [minDate, maxDate, monthsRange.length]);

  const isWeekInMilestone = (milestone, weekStart) => {
    if (!milestone.start_date || !milestone.end_date) return false;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const mStart = new Date(milestone.start_date);
    const mEnd   = new Date(milestone.end_date);
    return weekStart <= mEnd && weekEnd >= mStart;
  };

  // Derive status for a specific week's tasks within a milestone
  const getWeekStatus = (milestone, weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    // Find tasks belonging to this milestone that overlap this week
    const weekTasks = tasks.filter(t => {
      if (t.milestone !== milestone.id && t.milestone !== milestone.name) return false;
      if (!t.planned_start || !t.planned_end) return false;
      const ts = new Date(t.planned_start);
      const te = new Date(t.planned_end);
      return ts <= weekEnd && te >= weekStart;
    });
    if (weekTasks.length === 0) return milestone.derivedStatus || milestone.status || 'Not Started';
    return deriveMilestoneStatus(weekTasks);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Done':        return 'bg-emerald-200';
      case 'In Progress': return 'bg-amber-200';
      case 'Planned':     return 'bg-blue-200';
      case 'Blocked':     return 'bg-red-200';
      case 'Delayed':     return 'bg-orange-200';
      case 'Not Started': return 'bg-gray-200';
      default:            return 'bg-gray-100';
    }
  };

  // ─── Milestone CRUD ────────────────────────────────────────────────────────
  const handleAddMilestone = async () => {
    const name = window.prompt('Enter milestone name:');
    if (!name?.trim()) return;
    try {
      setSaving(true);
      const newMilestone = await upsertMilestone(project.id, null, {
        name: name.trim(),
        status: 'Not Started',
      });
      setMilestones((prev) => [...prev, newMilestone]);
      toast.success('Milestone added');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add milestone');
    } finally { setSaving(false); }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      setSaving(true);
      await deleteMilestone(milestoneId);
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      toast.success('Milestone deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete milestone');
    } finally { setSaving(false); }
  };

  const handleSaveName = async (milestoneId, moveToNext = false) => {
    if (!editingName.trim()) { setEditingId(null); return; }
    try {
      setSaving(true);
      await upsertMilestone(project.id, milestoneId, { name: editingName.trim() });
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, name: editingName.trim() } : m))
      );
      setEditingId(null);
      if (moveToNext) {
        // Move selection + edit to next milestone
        const idx = milestones.findIndex(m => m.id === milestoneId);
        const next = milestones[idx + 1];
        if (next) {
          setSelectedId(next.id);
          setEditingId(next.id);
          setEditingName(next.name);
        } else {
          setSelectedId(milestoneId);
        }
      } else {
        setSelectedId(milestoneId);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update milestone');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (milestoneId, newStatus) => {
    try {
      setSaving(true);
      await upsertMilestone(project.id, milestoneId, { status: newStatus });
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, status: newStatus } : m))
      );
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    } finally { setSaving(false); }
  };

  // ─── Drag-and-drop handlers ───────────────────────────────────────────────
  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent ghost image
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-999px;opacity:0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    dragNodeRef.current = ghost;
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  }, []);

  const handleDrop = useCallback(async (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOver(null);
      return;
    }
    // Reorder milestones array
    const reordered = [...milestones];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    // Assign new sort_order values
    const withOrder = reordered.map((m, i) => ({ ...m, sort_order: i + 1 }));
    setMilestones(withOrder);
    setDragIndex(null);
    setDragOver(null);
    try {
      // Send full objects — partial upsert can fail when NOT NULL columns (e.g. name) are omitted
      await bulkUpsertMilestones(withOrder);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save order');
    }
  }, [dragIndex, milestones]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOver(null);
    if (dragNodeRef.current) {
      dragNodeRef.current.remove();
      dragNodeRef.current = null;
    }
  }, []);

  // ─── Column resize handle ─────────────────────────────────────────────────
  const ResizeHandle = ({ colKey, w }) => (
    <div
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 transition-opacity z-10"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        resizingColRef.current = { key: colKey, startX: e.clientX, startW: w };
      }}
    />
  );

  // ─── Row-height resize handle (shown at header bottom) ───────────────────
  const RowResizeHandle = () => (
    <div
      className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-blue-400 opacity-0 hover:opacity-60 transition-opacity z-10"
      title="Drag to resize rows"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRowRef.current = { startY: e.clientY, startH: rowHeight };
      }}
    />
  );

  // ─── Gantt week column resize handle ─────────────────────────────────────
  const WeekResizeHandle = () => (
    <div
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 transition-opacity z-10"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        resizingWeekRef.current = { startX: e.clientX, startW: weekColWidth };
      }}
    />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // Helper for fixed-width cell style
  const cellW = (key) => ({ width: colWidths[key], minWidth: colWidths[key], maxWidth: colWidths[key] });
  const weekW = { width: weekColWidth, minWidth: weekColWidth };

  return (
    <div className="space-y-4 p-6 bg-gray-50 rounded-lg" onClick={() => { setSelectedId(null); setEditingId(null); }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Project Milestones</h2>
        {canEdit && (
          <button
            onClick={handleAddMilestone}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        )}
      </div>

      {/* Gantt Chart — single scroll container so scrollbar sits at the very bottom */}
      <div className="bg-white rounded-lg shadow select-none overflow-hidden" onClick={e => e.stopPropagation()}>
        <div
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 320px)' }}
        >
          {/* Inner wrapper expands to full content width */}
          <div style={{ minWidth: 'max-content' }}>

            {/* ── Header row ───────────────────────────────────────────── */}
            <div
              className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300"
              style={{ height: 46 }}
            >
              {/* Frozen header cells — sticky left */}
              <div
                className="sticky left-0 z-30 flex bg-gray-100 border-r border-gray-300"
                style={{ position: 'sticky' }}
              >
                {/* Drag handle column header */}
                {canEdit && (
                  <div
                    className="flex items-center justify-center border-r border-gray-300"
                    style={{ width: 24, minWidth: 24 }}
                  />
                )}
                {/* 3-dot column header */}
                {canEdit && (
                  <div
                    className="flex items-center justify-center border-r border-gray-300"
                    style={{ width: 36, minWidth: 36 }}
                  />
                )}
                {/* # */}
                <div
                  className="relative flex items-center px-3 py-2 font-semibold text-gray-700 text-xs border-r border-gray-300"
                  style={cellW('num')}
                >
                  <span className="truncate">#</span>
                  <ResizeHandle colKey="num" w={colWidths.num} />
                </div>
                {/* Milestone */}
                <div
                  className="relative flex items-center px-3 py-2 font-semibold text-gray-700 text-xs border-r border-gray-300"
                  style={cellW('name')}
                >
                  <span className="truncate">Milestone</span>
                  <ResizeHandle colKey="name" w={colWidths.name} />
                </div>
                {/* Status */}
                <div
                  className="relative flex items-center px-3 py-2 font-semibold text-gray-700 text-xs border-r border-gray-300"
                  style={cellW('status')}
                >
                  <span className="truncate">Status</span>
                  <ResizeHandle colKey="status" w={colWidths.status} />
                </div>
                {/* Start Date */}
                <div
                  className="relative flex items-center px-3 py-2 font-semibold text-gray-700 text-xs border-r border-gray-300"
                  style={cellW('start')}
                >
                  <span className="truncate">Start Date</span>
                  <ResizeHandle colKey="start" w={colWidths.start} />
                </div>
                {/* End Date */}
                <div
                  className="relative flex items-center px-3 py-2 font-semibold text-gray-700 text-xs border-r border-gray-300"
                  style={cellW('end')}
                >
                  <span className="truncate">End Date</span>
                  <ResizeHandle colKey="end" w={colWidths.end} />
                </div>
                {/* Row height resize handle */}
                <RowResizeHandle />
              </div>

              {/* Gantt week/month headers — two-row: month name + W1/W2/W3/W4 */}
              {monthsRange.length === 0 ? (
                <div className="flex items-center px-4 text-xs text-gray-400">No date range</div>
              ) : (
                <div className="flex flex-col flex-1">
                  {/* Row A: month name spanning its weeks */}
                  <div className="flex" style={{ height: 22, borderBottom: '1px solid #d1d5db' }}>
                    {monthsRange.map((month) => {
                      const monthWeeks = weeks.filter(
                        (w) => w.getFullYear() === month.getFullYear() && w.getMonth() === month.getMonth()
                      );
                      return (
                        <div
                          key={month.toISOString()}
                          className="flex items-center justify-center font-bold text-gray-700 border-r border-gray-300 text-[10px]"
                          style={{ width: weekColWidth * monthWeeks.length, minWidth: weekColWidth * monthWeeks.length }}
                        >
                          {month.toLocaleString('default', { month: 'short' })} {month.getFullYear()}
                        </div>
                      );
                    })}
                  </div>
                  {/* Row B: W1/W2/W3/W4 per month */}
                  <div className="flex" style={{ height: 22 }}>
                    {monthsRange.map((month) => {
                      const monthWeeks = weeks.filter(
                        (w) => w.getFullYear() === month.getFullYear() && w.getMonth() === month.getMonth()
                      );
                      return (
                        <div key={month.toISOString()} className="flex border-r border-gray-300">
                          {monthWeeks.map((week, wi) => (
                            <div
                              key={week.toISOString()}
                              className="relative flex items-center justify-center font-semibold text-gray-600 text-[10px] border-r border-gray-200"
                              style={weekW}
                            >
                              W{wi + 1}
                              <WeekResizeHandle />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Data rows ─────────────────────────────────────────────── */}
            {milestonesWithDates.length === 0 ? (
              <div className="px-3 py-6 text-gray-500 text-sm text-center">No milestones yet</div>
            ) : (
              milestonesWithDates.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className={`border-b border-gray-200 flex transition-colors ${
                    dragOver === index && dragIndex !== index ? 'border-t-2 border-t-blue-500 bg-blue-50/30' : ''
                  } ${dragIndex === index ? 'opacity-50' : ''}`}
                  style={{ height: rowHeight }}
                  onDragOver={canEdit ? (e) => handleDragOver(e, index) : undefined}
                  onDrop={canEdit ? (e) => handleDrop(e, index) : undefined}
                >
                  {/* Frozen row cells — sticky left */}
                  <div
                    className="sticky left-0 z-10 flex bg-white border-r border-gray-300 flex-shrink-0"
                  >
                    {/* ─── Drag Handle (FIRST column) ─── */}
                    {canEdit && (
                      <div
                        className="relative flex items-center justify-center border-r border-gray-200 flex-shrink-0 cursor-grab active:cursor-grabbing"
                        style={{ width: 24, minWidth: 24 }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3 h-3 text-gray-300 hover:text-gray-500" />
                      </div>
                    )}
                    {/* ─── 3-dot Actions Menu ─── */}
                    {canEdit && (
                      <div
                        className="relative flex items-center justify-center border-r border-gray-200 flex-shrink-0"
                        style={{ width: 36, minWidth: 36 }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === milestone.id ? null : milestone.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition"
                          title="Actions"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {openMenuId === milestone.id && (
                          <div
                            className="absolute left-8 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                            style={{ minWidth: 120 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDeleteMilestone(milestone.id);
                              }}
                              disabled={saving}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* # */}
                    <div
                      className="flex items-center justify-center px-1 text-xs text-gray-600 border-r border-gray-200 font-medium flex-shrink-0"
                      style={cellW('num')}
                    >
                      {index + 1}
                    </div>

                    {/* Milestone Name — coloured badge; first click = select, second click = edit */}
                    <div
                      className={`flex items-center px-3 border-r border-gray-200 overflow-hidden flex-shrink-0 cursor-default transition ${
                        editingId === milestone.id
                          ? 'outline outline-2 outline-blue-500 bg-white'
                          : selectedId === milestone.id
                            ? 'outline outline-1 outline-blue-300 bg-blue-50/40'
                            : ''
                      }`}
                      style={cellW('name')}
                      onClick={() => {
                        if (!canEdit) return;
                        if (selectedId === milestone.id && editingId !== milestone.id) {
                          // Second click — enter edit mode
                          setEditingId(milestone.id);
                          setEditingName(milestone.name);
                        } else if (editingId !== milestone.id) {
                          // First click — select only
                          setSelectedId(milestone.id);
                          setEditingId(null);
                        }
                      }}
                    >
                      {editingId === milestone.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleSaveName(milestone.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleSaveName(milestone.id, true); }
                            if (e.key === 'Escape') { setEditingId(null); setSelectedId(milestone.id); }
                          }}
                          autoFocus
                          className="w-full px-2 py-0.5 border-0 bg-transparent focus:outline-none text-xs font-semibold"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold border truncate max-w-full"
                          style={{
                            backgroundColor: milestone.color?.bg,
                            color: milestone.color?.text,
                            borderColor: milestone.color?.border,
                          }}
                          title={milestone.name}
                        >
                          {milestone.name}
                        </span>
                      )}
                    </div>

                    {/* Status — derived from tasks, manual override still available */}
                    <div
                      className="flex items-center px-3 border-r border-gray-200 flex-shrink-0"
                      style={cellW('status')}
                    >
                      {milestone.derivedStatus ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(milestone.derivedStatus)} text-gray-800 w-full text-center`}>
                          {milestone.derivedStatus}
                        </span>
                      ) : (
                        <select
                          value={milestone.status || 'Not Started'}
                          onChange={(e) => handleStatusChange(milestone.id, e.target.value)}
                          disabled={!canEdit}
                          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white w-full hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                          <option value="Blocked">Blocked</option>
                          <option value="Delayed">Delayed</option>
                          <option value="Planned">Planned</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      )}
                    </div>

                    {/* Start Date */}
                    <div
                      className="flex items-center px-1 text-[10px] text-gray-600 border-r border-gray-200 flex-shrink-0"
                      style={cellW('start')}
                    >
                      {milestone.start_date ? formatDate(new Date(milestone.start_date)) : '—'}
                    </div>

                    {/* End Date */}
                    <div
                      className="flex items-center px-1 text-[10px] text-gray-600 border-r border-gray-200 flex-shrink-0"
                      style={cellW('end')}
                    >
                      {milestone.end_date ? formatDate(new Date(milestone.end_date)) : '—'}
                    </div>
                  </div>

                  {/* Gantt cells */}
                  {monthsRange.map((month) => {
                    const monthWeeks = weeks.filter(
                      (w) => w.getFullYear() === month.getFullYear() && w.getMonth() === month.getMonth()
                    );
                    return (
                      <div key={month.toISOString()} className="flex border-r border-gray-300">
                        {monthWeeks.map((week) => {
                          const inMilestone = isWeekInMilestone(milestone, week);
                          const weekStatus = inMilestone ? getWeekStatus(milestone, week) : null;
                          return (
                            <div
                              key={week.toISOString()}
                              className={`border-r border-gray-200 flex items-center justify-center font-medium ${
                                inMilestone
                                  ? `${getStatusColor(weekStatus)} text-gray-900`
                                  : 'bg-white text-gray-300'
                              }`}
                              style={{ ...weekW, height: rowHeight, fontSize: 9 }}
                            >
                              {inMilestone && weekStatus}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { label: 'Planned',     cls: 'bg-blue-200' },
            { label: 'Done',        cls: 'bg-emerald-200' },
            { label: 'In Progress', cls: 'bg-amber-200' },
            { label: 'Blocked',     cls: 'bg-red-200' },
            { label: 'Delayed',     cls: 'bg-orange-200' },
            { label: 'Not Started', cls: 'bg-gray-200' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${cls}`} />
              <span className="text-xs text-gray-700">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Drag ⠿ handle to reorder rows · Drag column header right edge to resize columns · Drag Gantt week header right edge to resize week columns · Drag bottom edge of header row to resize rows
        </p>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Saving…</span>
        </div>
      )}
    </div>
  );
};

export default MilestonesTab;
