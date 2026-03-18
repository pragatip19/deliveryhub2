import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Calendar, Target, Zap, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPlanTasks, updateProject, getRaidItems } from '../../../lib/supabase';
import { calcSOWCompletion, getActiveTasks, getKickoffDate, getProjectedGoLive } from '../../../lib/calculations';
import { networkdays, addWorkdays, formatDate, formatDateInput, today, parseDate } from '../../../lib/workdays';

function getTargetDays(categoryName) {
  if (!categoryName) return 72;
  const n = categoryName.toLowerCase();
  if (n === 'cleen') return 36;
  if (n.includes('logbook')) return 60;
  return 72;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return formatDate(new Date(d)); } catch { return '—'; }
}

function StatCard({ icon: Icon, iconColor, bg, label, value, sub, editable, onEdit, editing, editValue, onEditChange, onSave, onCancel, type = 'text', accent }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1.5 ${bg}`}>
      <div className="flex items-center justify-between">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={14} className={iconColor} />
        </div>
        {editable && !editing && (
          <button onClick={onEdit} className="text-gray-300 hover:text-gray-500 transition-colors">
            <Edit2 size={12} />
          </button>
        )}
      </div>
      <div>
        <p className="text-[11px] text-slate-500 font-medium leading-none mb-1">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1 mt-1">
            <input type={type} value={editValue} onChange={e => onEditChange(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-2 py-0.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" autoFocus />
            <button onClick={onSave} className="text-green-600 hover:text-green-800"><Save size={12} /></button>
            <button onClick={onCancel} className="text-red-400 hover:text-red-600"><X size={12} /></button>
          </div>
        ) : (
          <p className="text-base font-bold text-slate-800 leading-tight">{value}</p>
        )}
        {sub && <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({ label, percent, colorClass, textClass }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${textClass}`}>{(percent ?? 0).toFixed(1)}%</span>
    </div>
  );
}

export default function ProjectHealth({ project, canEdit }) {
  const [tasks, setTasks] = useState([]);
  const [openRisks, setOpenRisks] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [localProject, setLocalProject] = useState(project);
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  useEffect(() => { setLocalProject(project); }, [project]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tasksData, risks, issues] = await Promise.all([
          getPlanTasks(project.id),
          getRaidItems(project.id, 'risk').catch(() => []),
          getRaidItems(project.id, 'issue').catch(() => []),
        ]);
        setTasks(tasksData || []);
        setOpenRisks((risks || []).filter(r => r.status !== 'Closed' && r.status !== 'Resolved').length);
        setOpenIssues((issues || []).filter(i => i.status !== 'Closed' && i.status !== 'Resolved').length);
      } catch { toast.error('Failed to load health data'); }
      setLoading(false);
    }
    if (project?.id) load();
  }, [project?.id]);

  const categoryName = localProject?.category_name || '';
  const targetDays = getTargetDays(categoryName);

  const kickoffFromPlan = getKickoffDate(tasks);
  const kickoffDate = localProject?.kickoff_date || kickoffFromPlan;
  const projectedGoLive = getProjectedGoLive(tasks) || localProject?.projected_go_live;
  const plannedGoLive = kickoffDate ? addWorkdays(new Date(kickoffDate), targetDays) : null;

  const workCompleted = kickoffDate ? networkdays(new Date(kickoffDate), today()) : 0;
  const projectedOnboardingDays = projectedGoLive && kickoffDate
    ? networkdays(new Date(kickoffDate), new Date(projectedGoLive)) : null;

  // Delay Days: Release System task — networkdays(baseline_planned_end, planned_end) - 1
  const releaseTask = tasks.find(t => t.activities?.toLowerCase().includes('release system'));
  const delayDays = (releaseTask?.baseline_planned_end && releaseTask?.planned_end)
    ? Math.max(0, networkdays(parseDate(releaseTask.baseline_planned_end), parseDate(releaseTask.planned_end)) - 1)
    : null;

  const sowCompletion = calcSOWCompletion(tasks, targetDays);
  const currentSOW = sowCompletion?.current ?? 0;
  const expectedSOW = sowCompletion?.expected ?? 0;
  const delta = currentSOW - expectedSOW;

  const activeTasks = getActiveTasks(tasks);
  const daysRemaining = plannedGoLive ? Math.max(0, networkdays(today(), new Date(plannedGoLive)) - 1) : null;

  const isDelayed = projectedGoLive && plannedGoLive && new Date(projectedGoLive) > new Date(plannedGoLive);
  const statusLabel = !kickoffDate ? 'Not Started' : (delayDays > 0 || isDelayed) ? 'Delayed' : 'On Track';
  const statusStyle = {
    'On Track': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Delayed': 'bg-red-100 text-red-700 border-red-200',
    'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  }[statusLabel];

  async function saveField(field, value) {
    try {
      await updateProject(localProject.id, { [field]: value || null });
      setLocalProject(p => ({ ...p, [field]: value }));
      setEditing(null);
      toast.success('Saved');
    } catch (e) { toast.error('Failed to save: ' + (e?.message || 'Unknown error')); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-5 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Project Health</h1>
          <p className="text-xs text-slate-500 mt-0.5">{localProject.name}{categoryName ? ` · ${categoryName}` : ''}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusStyle}`}>{statusLabel}</span>
      </div>

      {/* Top Row: Risks · Issues · Active Tasks · Delay Days */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={17} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700 leading-none">{openRisks}</p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Open Risks</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={17} className="text-red-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-red-700 leading-none">{openIssues}</p>
            <p className="text-[11px] text-red-600 font-medium mt-0.5">Open Issues</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={17} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-700 leading-none">{activeTasks}</p>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">Active Tasks</p>
          </div>
        </div>

        <div className={`border rounded-xl p-3 flex items-center gap-3 ${
          delayDays === null ? 'bg-slate-50 border-slate-200'
          : delayDays > 0 ? 'bg-orange-50 border-orange-200'
          : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            delayDays === null ? 'bg-slate-100' : delayDays > 0 ? 'bg-orange-100' : 'bg-emerald-100'
          }`}>
            <Zap size={17} className={
              delayDays === null ? 'text-slate-400' : delayDays > 0 ? 'text-orange-600' : 'text-emerald-600'
            } />
          </div>
          <div>
            <p className={`text-xl font-bold leading-none ${
              delayDays === null ? 'text-slate-400' : delayDays > 0 ? 'text-orange-700' : 'text-emerald-700'
            }`}>
              {delayDays === null ? '—' : delayDays > 0 ? `+${delayDays}d` : '0d'}
            </p>
            <p className={`text-[11px] font-medium mt-0.5 ${
              delayDays === null ? 'text-slate-400' : delayDays > 0 ? 'text-orange-600' : 'text-emerald-600'
            }`}>Delay Days</p>
            {releaseTask && <p className="text-[10px] text-slate-400">Release System</p>}
          </div>
        </div>
      </div>

      {/* Key Dates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Calendar} iconColor="text-violet-600" bg="bg-violet-50 border border-violet-100" accent="bg-violet-100"
          label="Kickoff Date" value={fmtDate(kickoffDate)}
          sub={kickoffFromPlan && !localProject?.kickoff_date ? 'From plan' : 'Manual'}
          editable={canEdit} editing={editing === 'kickoff_date'} editValue={editVal} type="date"
          onEdit={() => { setEditing('kickoff_date'); setEditVal(kickoffDate ? formatDateInput(new Date(kickoffDate)) : ''); }}
          onEditChange={setEditVal} onSave={() => saveField('kickoff_date', editVal)} onCancel={() => setEditing(null)}
        />
        <StatCard icon={Calendar} iconColor="text-slate-500" bg="bg-slate-50 border border-slate-200" accent="bg-slate-100"
          label="PO Date" value={fmtDate(localProject?.po_date)}
          editable={canEdit} editing={editing === 'po_date'} editValue={editVal} type="date"
          onEdit={() => { setEditing('po_date'); setEditVal(localProject?.po_date || ''); }}
          onEditChange={setEditVal} onSave={() => saveField('po_date', editVal)} onCancel={() => setEditing(null)}
        />
        <StatCard icon={Target} iconColor="text-indigo-600" bg="bg-indigo-50 border border-indigo-100" accent="bg-indigo-100"
          label="Target SOW Days" value={`${targetDays} days`} sub={`${categoryName || 'Default'} benchmark`}
        />
        <StatCard icon={Clock} iconColor="text-teal-600" bg="bg-teal-50 border border-teal-100" accent="bg-teal-100"
          label="Work Completed" value={workCompleted ? `${workCompleted}d` : '—'}
          sub={kickoffDate ? `Since ${fmtDate(kickoffDate)}` : 'Awaiting kickoff'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} iconColor="text-green-600" bg="bg-green-50 border border-green-100" accent="bg-green-100"
          label="Planned Go-Live" value={fmtDate(plannedGoLive)}
          sub={kickoffDate ? `Kickoff + ${targetDays}d` : 'Awaiting kickoff'}
        />
        <StatCard icon={TrendingUp} iconColor="text-blue-600" bg="bg-blue-50 border border-blue-100" accent="bg-blue-100"
          label="Projected Go-Live" value={fmtDate(projectedGoLive)} sub="From Release System task"
        />
        <StatCard icon={Clock} iconColor="text-orange-600" bg="bg-orange-50 border border-orange-100" accent="bg-orange-100"
          label="Projected Days" value={projectedOnboardingDays ? `${projectedOnboardingDays}d` : '—'}
          sub="Kickoff → Projected go-live"
        />
        <StatCard icon={TrendingDown} iconColor="text-pink-600" bg="bg-pink-50 border border-pink-100" accent="bg-pink-100"
          label="Days Remaining" value={daysRemaining !== null ? `${daysRemaining}d` : '—'}
          sub="Until planned go-live"
        />
      </div>

      {/* SOW Completion */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">SOW Completion</h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border ${
            delta >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : delta >= -10 ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {delta >= 0 ? <TrendingUp size={11} /> : delta >= -10 ? <Minus size={11} /> : <TrendingDown size={11} />}
            {delta >= 0 ? `+${delta.toFixed(1)}% ahead` : `${Math.abs(delta).toFixed(1)}% behind`}
          </span>
        </div>
        <div className="space-y-2.5">
          <MiniBar label="Current %" percent={currentSOW} colorClass="bg-emerald-500" textClass="text-emerald-700" />
          <MiniBar label="Expected %" percent={expectedSOW} colorClass="bg-blue-400" textClass="text-blue-600" />
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-emerald-500 inline-block" /> Current: Done task duration / total</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-blue-400 inline-block" /> Expected: overdue task duration / total</span>
        </div>
      </div>
    </div>
  );
}
