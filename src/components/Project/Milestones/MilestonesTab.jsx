import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMilestones,
  upsertMilestone,
  deleteMilestone,
  getPlanTasks,
  recalcMilestoneDates,
} from '../../../lib/supabase';
import { formatDate, networkdays, getWeekNumber } from '../../../lib/workdays';
import StatusBadge from '../../shared/StatusBadge';

const MilestonesTab = ({ project, canEdit }) => {
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Load milestones and tasks on mount
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

    if (project?.id) {
      loadData();
    }
  }, [project?.id]);

  // Auto-calculate milestone dates from tasks
  const milestonesWithDates = useMemo(() => {
    return milestones.map((milestone) => {
      const relatedTasks = tasks.filter((task) => task.milestone === milestone.name);
      if (relatedTasks.length === 0) {
        return milestone;
      }

      const startDate = new Date(
        Math.min(...relatedTasks.map((t) => new Date(t.planned_start)))
      );
      const endDate = new Date(
        Math.max(...relatedTasks.map((t) => new Date(t.planned_end)))
      );

      return {
        ...milestone,
        start_date: startDate,
        end_date: endDate,
      };
    });
  }, [milestones, tasks]);

  // Calculate Gantt chart date range
  const { monthsRange, minDate, maxDate } = useMemo(() => {
    if (milestonesWithDates.length === 0) {
      return { monthsRange: [], minDate: new Date(), maxDate: new Date() };
    }

    const dates = milestonesWithDates
      .flatMap((m) => [new Date(m.start_date), new Date(m.end_date)])
      .filter((d) => !isNaN(d.getTime()));

    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add 1 month buffer
    max.setMonth(max.getMonth() + 1);

    // Generate months
    const months = [];
    let current = new Date(min.getFullYear(), min.getMonth(), 1);
    while (current <= max) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return { monthsRange: months, minDate: min, maxDate: max };
  }, [milestonesWithDates]);

  // Generate week columns for Gantt chart
  const weeks = useMemo(() => {
    const weeksList = [];
    let current = new Date(minDate);
    current.setDate(current.getDate() - current.getDay()); // Start from Sunday

    while (current <= maxDate) {
      weeksList.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }

    return weeksList;
  }, [minDate, maxDate]);

  // Check if a week falls within milestone date range
  const isWeekInMilestone = (milestone, weekStart) => {
    if (!milestone.start_date || !milestone.end_date) return false;

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const mStart = new Date(milestone.start_date);
    const mEnd = new Date(milestone.end_date);

    return weekStart <= mEnd && weekEnd >= mStart;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Done':
        return 'bg-green-400';
      case 'In Progress':
        return 'bg-yellow-400';
      case 'Planned':
        return 'bg-blue-400';
      case 'Blocked':
        return 'bg-red-400';
      case 'Delayed':
        return 'bg-orange-400';
      case 'Not Started':
        return 'bg-gray-300';
      case 'Not Applicable':
        return 'bg-gray-200';
      default:
        return 'bg-gray-300';
    }
  };

  // Add new milestone
  const handleAddMilestone = async () => {
    try {
      setSaving(true);
      const name = prompt('Enter milestone name:');
      if (!name?.trim()) return;

      const newMilestone = await upsertMilestone(project.id, null, {
        name: name.trim(),
        status: 'Not Started',
      });

      setMilestones((prev) => [...prev, newMilestone]);
      toast.success('Milestone added');
    } catch (error) {
      console.error('Failed to add milestone:', error);
      toast.error('Failed to add milestone');
    } finally {
      setSaving(false);
    }
  };

  // Delete milestone
  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm('Delete this milestone?')) return;

    try {
      setSaving(true);
      await deleteMilestone(milestoneId);
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      toast.success('Milestone deleted');
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      toast.error('Failed to delete milestone');
    } finally {
      setSaving(false);
    }
  };

  // Edit milestone name (inline)
  const handleEditName = (milestoneId, currentName) => {
    setEditingId(milestoneId);
    setEditingName(currentName);
  };

  // Save milestone name
  const handleSaveName = async (milestoneId) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      setSaving(true);
      await upsertMilestone(project.id, milestoneId, { name: editingName.trim() });
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, name: editingName.trim() } : m))
      );
      setEditingId(null);
      toast.success('Milestone name updated');
    } catch (error) {
      console.error('Failed to update milestone:', error);
      toast.error('Failed to update milestone');
    } finally {
      setSaving(false);
    }
  };

  // Update milestone status
  const handleStatusChange = async (milestoneId, newStatus) => {
    try {
      setSaving(true);
      await upsertMilestone(project.id, milestoneId, { status: newStatus });
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, status: newStatus } : m))
      );
      toast.success('Status updated');
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

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

      {/* Gantt Chart Container */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex overflow-hidden">
          {/* Frozen Left Panel */}
          <div className="flex-shrink-0 bg-white border-r border-gray-300">
            {/* Header Row */}
            <div className="sticky top-0 z-20 bg-gray-100 border-b border-gray-300 flex">
              <div className="w-12 px-3 py-3 font-semibold text-gray-700 text-xs border-r border-gray-300 flex items-center justify-center">#</div>
              <div className="w-56 px-3 py-3 font-semibold text-gray-700 text-xs border-r border-gray-300 truncate">
                Milestone
              </div>
              <div className="w-32 px-3 py-3 font-semibold text-gray-700 text-xs border-r border-gray-300">
                Status
              </div>
              <div className="w-28 px-3 py-3 font-semibold text-gray-700 text-xs border-r border-gray-300">
                Start Date
              </div>
              <div className="w-28 px-3 py-3 font-semibold text-gray-700 text-xs">
                End Date
              </div>
            </div>

            {/* Data Rows */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {milestonesWithDates.length === 0 ? (
                <div className="px-3 py-6 text-gray-500 text-sm text-center w-full">
                  No milestones yet
                </div>
              ) : (
                milestonesWithDates.map((milestone, index) => (
                  <div
                    key={milestone.id}
                    className="border-b border-gray-200 hover:bg-blue-50 transition flex"
                  >
                    {/* # */}
                    <div className="w-12 px-3 py-4 text-sm text-gray-600 border-r border-gray-200 flex items-center justify-center font-medium">
                      {index + 1}
                    </div>

                    {/* Milestone Name */}
                    <div className="w-56 px-3 py-4 text-sm border-r border-gray-200 truncate">
                      {editingId === milestone.id ? (
                        <div className="flex gap-2">
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
                            className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditName(milestone.id, milestone.name)}
                          disabled={!canEdit}
                          className="text-gray-900 font-medium hover:text-blue-600 disabled:cursor-default disabled:hover:text-gray-900"
                        >
                          {milestone.name}
                        </button>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-32 px-3 py-4 border-r border-gray-200">
                      <select
                        value={milestone.status || 'Not Started'}
                        onChange={(e) => handleStatusChange(milestone.id, e.target.value)}
                        disabled={!canEdit}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                        <option value="Blocked">Blocked</option>
                        <option value="Delayed">Delayed</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>

                    {/* Start Date */}
                    <div className="w-28 px-3 py-4 text-xs text-gray-600 border-r border-gray-200">
                      {milestone.start_date ? formatDate(new Date(milestone.start_date)) : 'N/A'}
                    </div>

                    {/* End Date */}
                    <div className="w-28 px-3 py-4 text-xs text-gray-600">
                      {milestone.end_date ? formatDate(new Date(milestone.end_date)) : 'N/A'}
                    </div>

                    {/* Delete Button (in frozen area) */}
                    {canEdit && (
                      <div className="absolute right-2 top-4">
                        <button
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          disabled={saving}
                          className="p-1 hover:bg-red-100 rounded transition disabled:opacity-50"
                          title="Delete milestone"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Scrollable Gantt Chart Right Panel */}
          <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {/* Gantt Header */}
            <div className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300 flex">
              {monthsRange.map((month) => {
                const monthWeeks = weeks.filter((w) => {
                  const wMonth = new Date(w);
                  return wMonth.getFullYear() === month.getFullYear() && wMonth.getMonth() === month.getMonth();
                });

                return (
                  <div key={month.toISOString()} className="flex border-r border-gray-300">
                    {monthWeeks.map((week, weekIndex) => (
                      <div
                        key={week.toISOString()}
                        className="min-w-24 px-2 py-3 font-semibold text-gray-700 text-xs border-r border-gray-300 text-center"
                      >
                        W{getWeekNumber(week)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Gantt Rows */}
            <div>
              {milestonesWithDates.length === 0 ? (
                <div className="px-4 py-6 text-gray-500 text-sm">No milestones to display</div>
              ) : (
                milestonesWithDates.map((milestone) => (
                  <div key={milestone.id} className="border-b border-gray-200 hover:bg-blue-50 transition flex">
                    {monthsRange.map((month) => {
                      const monthWeeks = weeks.filter((w) => {
                        const wMonth = new Date(w);
                        return wMonth.getFullYear() === month.getFullYear() && wMonth.getMonth() === month.getMonth();
                      });

                      return (
                        <div key={month.toISOString()} className="flex border-r border-gray-300">
                          {monthWeeks.map((week) => {
                            const inMilestone = isWeekInMilestone(milestone, week);
                            const statusColor = inMilestone
                              ? getStatusColor(milestone.status || 'Planned')
                              : 'bg-white';

                            return (
                              <div
                                key={week.toISOString()}
                                className={`min-w-24 h-16 border-r border-gray-200 flex items-center justify-center text-xs font-medium transition ${statusColor} ${
                                  inMilestone ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {inMilestone && 'Planned'}
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
        <h3 className="font-semibold text-gray-900 mb-3">Status Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <span>Planned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span>Done</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400 rounded"></div>
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-400 rounded"></div>
            <span>Delayed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <span>Not Started</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MilestonesTab;
