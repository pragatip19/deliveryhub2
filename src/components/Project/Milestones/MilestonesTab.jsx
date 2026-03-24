import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMilestones,
  upsertMilestone,
  deleteMilestone,
  getPlanTasks,
} from '../../../lib/supabase';
import { formatDate, getWeekNumber } from '../../../lib/workdays';

// ─── Default column widths (px) ────────────────────────────────────────────
const COL_DEFAULTS = { num: 48, name: 224, status: 128, start: 112, end: 112 };
const ROW_HEIGHT_DEFAULT = 64; // px
const LS_COL_KEY = 'msColWidths';
const LS_ROW_KEY = 'msRowHeight';

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

const MilestonesTab = ({ project, canEdit }) => {
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Resize state
  const [colWidths, setColWidths] = useState(loadColWidths);
  const [rowHeight, setRowHeight] = useState(loadRowHeight);
  const resizingColRef = useRef(null); // { key, startX, startW }
  const resizingRowRef = useRef(null); // { startY, startH }

  // Persist resize to localStorage
  useEffect(() => {
    try { localStorage.setItem(LS_COL_KEY, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  useEffect(() => {
    try { localStorage.setItem(LS_ROW_KEY, String(rowHeight)); } catch {}
  }, [rowHeight]);

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
    };
    const onUp = () => {
      resizingColRef.current = null;
      resizingRowRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

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
        setTasks(tasksData);
      } catch (error) {
        console.error('Failed to load milestones:', error);
        toast.error('Failed to load milestones');
      } finally {
        setLoading(false);
      }
    };
    if (project?.id) loadData();
  }, [project?.id]);

  // ─── Compute milestone date ranges from plan tasks ────────────────────────
  const milestonesWithDates = useMemo(() => {
    return milestones.map((milestone) => {
      const relatedTasks = tasks.filter((t) => t.milestone === milestone.name);
      if (!relatedTasks.length) return milestone;
      const starts = relatedTasks.map((t) => new Date(t.planned_start)).filter((d) => !isNaN(d));
      const ends = relatedTasks.map((t) => new Date(t.planned_end)).filter((d) => !isNaN(d));
      if (!starts.length || !ends.length) return milestone;
      return {
        ...milestone,
        start_date: new Date(Math.min(...starts)),
        end_date: new Date(Math.max(...ends)),
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
    const mEnd = new Date(milestone.end_date);
    return weekStart <= mEnd && weekEnd >= mStart;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Done': return 'bg-green-400';
      case 'In Progress': return 'bg-yellow-400';
      case 'Planned': return 'bg-blue-400';
      case 'Blocked': return 'bg-red-400';
      case 'Delayed': return 'bg-orange-400';
      case 'Not Started': return 'bg-gray-300';
      default: return 'bg-gray-200';
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

  const handleSaveName = async (milestoneId) => {
    if (!editingName.trim()) { setEditingId(null); return; }
    try {
      setSaving(true);
      await upsertMilestone(project.id, milestoneId, { name: editingName.trim() });
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, name: editingName.trim() } : m))
      );
      setEditingId(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // Helper for cell style
  const cellW = (key) => ({ width: colWidths[key], minWidth: colWidths[key], maxWidth: colWidths[key] });

  return (
    <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
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

      {/* Gantt Chart */}
      <div className="bg-white rounded-lg shadow overflow-hidden select-none">
        <div className="flex overflow-hidden">

          {/* ── Frozen Left Panel ─────────────────────────────────────── */}
          <div className="flex-shrink-0 bg-white border-r border-gray-300" style={{ position: 'relative' }}>
            {/* Header Row */}
            <div className="sticky top-0 z-20 bg-gray-100 border-b border-gray-300 flex relative" style={{ height: 44 }}>
              {[
                { key: 'num', label: '#' },
                { key: 'name', label: 'Milestone' },
                { key: 'status', label: 'Status' },
                { key: 'start', label: 'Start Date' },
                { key: 'end', label: 'End Date' },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="relative flex items-center px-3 py-2 font-semibold text-gray-700 text-xs border-r border-gray-300 overflow-hidden"
                  style={cellW(key)}
                >
                  <span className="truncate">{label}</span>
                  <ResizeHandle colKey={key} w={colWidths[key]} />
                </div>
              ))}
              {/* Row height resize handle at header bottom */}
              <RowResizeHandle />
            </div>

            {/* Data Rows */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              {milestonesWithDates.length === 0 ? (
                <div className="px-3 py-6 text-gray-500 text-sm text-center">No milestones yet</div>
              ) : (
                milestonesWithDates.map((milestone, index) => (
                  <div
                    key={milestone.id}
                    className="border-b border-gray-200 hover:bg-blue-50 transition flex relative"
                    style={{ height: rowHeight }}
                  >
                    {/* # */}
                    <div
                      className="flex items-center justify-center px-3 text-sm text-gray-600 border-r border-gray-200 font-medium flex-shrink-0"
                      style={cellW('num')}
                    >
                      {index + 1}
                    </div>

                    {/* Milestone Name */}
                    <div
                      className="flex items-center px-3 border-r border-gray-200 overflow-hidden flex-shrink-0"
                      style={cellW('name')}
                    >
                      {editingId === milestone.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleSaveName(milestone.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(milestone.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
                        />
                      ) : (
                        <button
                          onClick={() => canEdit && (setEditingId(milestone.id), setEditingName(milestone.name))}
                          disabled={!canEdit}
                          className="text-gray-900 font-medium text-sm hover:text-blue-600 disabled:cursor-default disabled:hover:text-gray-900 truncate w-full text-left"
                        >
                          {milestone.name}
                        </button>
                      )}
                    </div>

                    {/* Status */}
                    <div
                      className="flex items-center px-3 border-r border-gray-200 flex-shrink-0"
                      style={cellW('status')}
                    >
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
                    </div>

                    {/* Start Date */}
                    <div
                      className="flex items-center px-3 text-xs text-gray-600 border-r border-gray-200 flex-shrink-0"
                      style={cellW('start')}
                    >
                      {milestone.start_date ? formatDate(new Date(milestone.start_date)) : '—'}
                    </div>

                    {/* End Date */}
                    <div
                      className="flex items-center px-3 text-xs text-gray-600 flex-shrink-0"
                      style={cellW('end')}
                    >
                      {milestone.end_date ? formatDate(new Date(milestone.end_date)) : '—'}
                    </div>

                    {/* Delete */}
                    {canEdit && (
                      <div className="flex items-center px-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          disabled={saving}
                          className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                          title="Delete milestone"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Scrollable Gantt Panel ──────────────────────────────────── */}
          <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {/* Month + Week headers */}
            <div className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300" style={{ height: 44 }}>
              <div className="flex h-full">
                {monthsRange.map((month) => {
                  const monthWeeks = weeks.filter((w) => {
                    return w.getFullYear() === month.getFullYear() && w.getMonth() === month.getMonth();
                  });
                  return (
                    <div key={month.toISOString()} className="flex border-r border-gray-300">
                      {monthWeeks.map((week) => (
                        <div
                          key={week.toISOString()}
                          className="flex items-center justify-center min-w-24 px-2 font-semibold text-gray-700 text-xs border-r border-gray-300"
                        >
                          <span className="text-gray-500 mr-1 text-xs">
                            {month.toLocaleString('default', { month: 'short' })}
                          </span>
                          W{getWeekNumber(week)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gantt Rows */}
            <div>
              {milestonesWithDates.length === 0 ? (
                <div className="px-4 py-6 text-gray-500 text-sm">No milestones to display</div>
              ) : (
                milestonesWithDates.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="border-b border-gray-200 hover:bg-blue-50 transition flex"
                    style={{ height: rowHeight }}
                  >
                    {monthsRange.map((month) => {
                      const monthWeeks = weeks.filter((w) =>
                        w.getFullYear() === month.getFullYear() && w.getMonth() === month.getMonth()
                      );
                      return (
                        <div key={month.toISOString()} className="flex border-r border-gray-300">
                          {monthWeeks.map((week) => {
                            const inMilestone = isWeekInMilestone(milestone, week);
                            const bgColor = inMilestone ? getStatusColor(milestone.status || 'Planned') : 'bg-white';
                            return (
                              <div
                                key={week.toISOString()}
                                className={`min-w-24 border-r border-gray-200 flex items-center justify-center text-xs font-medium transition ${bgColor} ${
                                  inMilestone ? 'text-gray-900' : 'text-gray-300'
                                }`}
                                style={{ height: rowHeight }}
                              >
                                {inMilestone && milestone.status}
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
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { label: 'Planned', cls: 'bg-blue-400' },
            { label: 'Done', cls: 'bg-green-400' },
            { label: 'In Progress', cls: 'bg-yellow-400' },
            { label: 'Blocked', cls: 'bg-red-400' },
            { label: 'Delayed', cls: 'bg-orange-400' },
            { label: 'Not Started', cls: 'bg-gray-300' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${cls}`} />
              <span className="text-xs text-gray-700">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Drag column header right edge to resize columns · Drag bottom edge of header row to resize rows
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
