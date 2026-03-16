import React, { useState, useEffect } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPlanTasks,
  updateProject,
} from '../../../lib/supabase';
import {
  calcSOWCompletion,
  getActiveTasks,
  getKickoffDate,
  getProjectedGoLive,
  getTargetOnboardingDays,
} from '../../../lib/calculations';
import {
  networkdays,
  addWorkdays,
  formatDate,
  formatDateInput,
  today,
} from '../../../lib/workdays';

const ProjectHealth = ({ project, canEdit }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const isAdmin = canEdit && project?.role === 'admin';

  // Calculate metrics
  const kickoffDate = getKickoffDate(tasks);
  const projectedGoLive = getProjectedGoLive(tasks);
  const activeTasks = getActiveTasks(tasks);
  const sowCompletion = calcSOWCompletion(tasks);
  const targetOnboardingDays = getTargetOnboardingDays(project?.category);

  // Calculate work completed
  const workCompleted = kickoffDate ? networkdays(kickoffDate, today()) : null;

  // Calculate dates
  const plannedGoLive = kickoffDate && targetOnboardingDays
    ? addWorkdays(kickoffDate, targetOnboardingDays)
    : null;

  const projectedOnboardingDays = projectedGoLive && kickoffDate
    ? networkdays(kickoffDate, projectedGoLive)
    : null;

  const actualOnboardingDays = projectedGoLive && kickoffDate
    ? networkdays(kickoffDate, projectedGoLive)
    : null;

  // Load tasks on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const tasksData = await getPlanTasks(project.id);
        setTasks(tasksData || []);

        // Auto-save kickoff_date and projected_go_live
        if (kickoffDate || projectedGoLive) {
          const updates = {};
          if (kickoffDate && !project.kickoff_date) updates.kickoff_date = kickoffDate;
          if (projectedGoLive && !project.projected_go_live) updates.projected_go_live = projectedGoLive;

          if (Object.keys(updates).length > 0) {
            await updateProject(project.id, updates);
          }
        }
      } catch (error) {
        console.error('Error loading health data:', error);
        toast.error('Failed to load project health');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [project?.id]);

  // Handle edit save
  const handleSaveEdit = async () => {
    if (!editingField) return;

    try {
      const updates = { [editingField]: editValue };
      await updateProject(project.id, updates);

      // Update local state
      if (editingField === 'po_date') {
        project.po_date = editValue;
      }

      setEditingField(null);
      setEditValue('');
      toast.success('Saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes');
    }
  };

  // Metric card component
  const MetricCard = ({ label, value, subtext, isEditable, onEdit }) => (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-600">{label}</h3>
        {isEditable && !editingField && (
          <button
            onClick={() => {
              setEditingField(label);
              setEditValue(value || '');
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <Edit2 size={16} />
          </button>
        )}
      </div>

      {editingField === label && isEditable ? (
        <div className="flex items-center gap-2 mb-2">
          <input
            type={label.includes('Date') ? 'date' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            autoFocus
          />
          <button
            onClick={handleSaveEdit}
            className="p-1 text-green-600 hover:text-green-800"
          >
            <Save size={16} />
          </button>
          <button
            onClick={() => setEditingField(null)}
            className="p-1 text-red-600 hover:text-red-800"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="text-lg font-bold text-gray-900 mb-1">
          {value || '—'}
        </div>
      )}

      {subtext && (
        <p className="text-xs text-gray-500">{subtext}</p>
      )}
    </div>
  );

  // Progress bar component
  const ProgressBar = ({ label, current, expected, total = 100 }) => {
    const currentPercent = Math.min((current / total) * 100, 100);
    const expectedPercent = Math.min((expected / total) * 100, 100);
    const delta = current - expected;
    const isOnTrack = delta >= -5;

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-sm font-bold text-gray-900">{currentPercent.toFixed(0)}%</span>
        </div>

        {/* Current progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-all"
            style={{ width: `${currentPercent}%` }}
          />
        </div>

        {/* Expected progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
          <div
            className="bg-blue-400 h-full rounded-full transition-all"
            style={{ width: `${expectedPercent}%` }}
          />
        </div>

        {/* Status text */}
        <div className={`text-xs font-semibold ${isOnTrack ? 'text-green-600' : 'text-orange-600'}`}>
          {isOnTrack ? (
            <span>On Track</span>
          ) : (
            <span>Behind Schedule by {Math.abs(delta).toFixed(0)}%</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading project health...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">{project.name} › Project Health</h2>

      {/* Row 1: Auto-calculated fields */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          label="Kickoff Date"
          value={kickoffDate ? formatDate(kickoffDate) : '—'}
          subtext="From 'Conduct Kick-off call' task"
        />

        <MetricCard
          label="PO Date"
          value={project.po_date ? formatDate(project.po_date) : '—'}
          isEditable={canEdit}
          onEdit={() => {
            setEditingField('po_date');
            setEditValue(project.po_date || '');
          }}
        />

        <MetricCard
          label="Target SOW Completion Days"
          value={targetOnboardingDays}
          subtext={`For ${project.category || 'N/A'}`}
        />

        <MetricCard
          label="Work Completed (Working Days)"
          value={workCompleted || '—'}
          subtext={kickoffDate ? `Since ${formatDate(kickoffDate)}` : 'Awaiting kickoff'}
        />

        <MetricCard
          label="Active Tasks"
          value={activeTasks}
          subtext={`${activeTasks} task${activeTasks !== 1 ? 's' : ''} in progress`}
        />
      </div>

      {/* Row 2: Go-live metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Planned Go-Live"
          value={plannedGoLive ? formatDate(plannedGoLive) : '—'}
          subtext={kickoffDate ? `Based on ${targetOnboardingDays} working days` : 'Awaiting kickoff'}
        />

        <MetricCard
          label="Projected Go-Live"
          value={projectedGoLive ? formatDate(projectedGoLive) : '—'}
          subtext="From 'Release System' task"
        />

        <MetricCard
          label="Projected Onboarding Days"
          value={projectedOnboardingDays || '—'}
          subtext={projectedGoLive ? 'Working days' : 'Not yet determined'}
        />

        {actualOnboardingDays && (
          <MetricCard
            label="Actual Onboarding Days"
            value={actualOnboardingDays}
            subtext="Working days elapsed"
          />
        )}
      </div>

      {/* SOW Completion */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">SOW Completion %</h3>

        <div className="space-y-4">
          <ProgressBar
            label="Current %"
            current={sowCompletion.current}
            expected={sowCompletion.expected}
            total={100}
          />

          <ProgressBar
            label="Expected %"
            current={sowCompletion.expected}
            expected={sowCompletion.expected}
            total={100}
          />
        </div>

        {/* Delta indicator */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          {sowCompletion.delta < -5 ? (
            <div className="bg-orange-50 border border-orange-200 rounded p-3">
              <p className="text-sm font-semibold text-orange-800">
                Behind Schedule by {Math.abs(sowCompletion.delta).toFixed(0)}%
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Current completion is below expected pace for this project stage
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-sm font-semibold text-green-800">
                On Track
              </p>
              <p className="text-xs text-green-700 mt-1">
                Project completion is aligned with planned timeline
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Admin override note */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
          Admin: All read-only fields can be overridden by clicking the edit icon.
        </div>
      )}
    </div>
  );
};

export default ProjectHealth;
