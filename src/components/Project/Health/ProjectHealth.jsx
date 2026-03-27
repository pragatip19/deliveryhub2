import React, { useState, useEffect, useMemo } from 'react';
import { Edit2, Save, X, AlertTriangle, Activity, TrendingUp, TrendingDown, Minus, Calendar, Target, Clock, AlertCircle, CalendarDays, Plus, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPlanTasks, updateProject, getRaidItems } from '../../../lib/supabase';
import { calcSOWCompletion, getActiveTasks, getKickoffDate, getProjectedGoLive, recalculatePlan } from '../../../lib/calculations';
import { networkdays, addWorkdays, formatDate, formatDateInput, today, parseDate, toDateStr } from '../../../lib/workdays';

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

// ── Compact stat card ──────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconColor, bg, accent, label, value, sub, editable, onEdit, editing, editValue, onEditChange, onSave, onCancel, type = 'text' }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1.5 ${bg}`}>
      <div className="flex items-center justify-between">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={13} className={iconColor} />
        </div>
        {editable && !editing && (
          <button onClick={onEdit} className="text-gray-300 hover:text-gray-500 transition-colors">
            <Edit2 size={11} />
          </button>
        )}
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-medium leading-none mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1 mt-1">
            <input type={type} value={editValue} onChange={e => onEditChange(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" autoFocus />
            <button onClick={onSave} className="text-green-600 hover:text-green-800"><Save size={11} /></button>
            <button onClick={onCancel} className="text-red-400 hover:text-red-600"><X size={11} /></button>
          </div>
        ) : (
          <p className="text-sm font-bold text-slate-800 leading-tight">{value}</p>
        )}
        {sub && <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{sub}</p>}
      </div>
    </div>
  );
}

// ── Coloured count box (risks / issues) ───────────────────────────────────────
function CountBox({ icon: Icon, count, label, bg, iconBg, iconColor, textColor }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-2.5 ${bg}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none ${textColor}`}>{count}</p>
        <p className={`text-[10px] font-medium mt-0.5 ${textColor} opacity-80`}>{label}</p>
      </div>
    </div>
  );
}

// ── SOW progress bar ──────────────────────────────────────────────────────────
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
  const [tasks, setTasks]           = useState([]);
  const [openRisks, setOpenRisks]   = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [localProject, setLocalProject] = useState(project);
  const [editing, setEditing]       = useState(null);
  const [editVal, setEditVal]       = useState('');

  const dmActionsKey = `dmActions_${project?.id}`;
  const [dmActions, setDmActions]   = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`dmActions_${project?.id}`) || '[]');
      const arr = Array.isArray(saved) ? saved : [];
      const normalized = arr.map(a => ({
        text: a.text || '', byWhen: a.byWhen || '',
        status: a.status || 'Not Started', impact: a.impact || '',
      }));
      return normalized.length > 0 ? normalized : [{ text: '', byWhen: '', status: 'Not Started', impact: '' }];
    } catch {
      return [{ text: '', byWhen: '', status: 'Not Started', impact: '' }];
    }
  });
  const [dmMenuOpen, setDmMenuOpen] = useState(null);

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
        // Recalculate so derived fields (days_delay, delay_status) are populated —
        // they are stripped before DB saves in ProjectPlan so we must recompute here.
        const calcTasks = tasksData?.length ? recalculatePlan(tasksData) : (tasksData || []);
        setTasks(calcTasks);
        setOpenRisks((risks || []).filter(r => r.status !== 'Closed' && r.status !== 'Resolved').length);
        setOpenIssues((issues || []).filter(i => i.status !== 'Closed' && i.status !== 'Resolved').length);
      } catch { toast.error('Failed to load health data'); }
      setLoading(false);
    }
    if (project?.id) load();
  }, [project?.id]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const categoryName = localProject?.category_name || '';
  // Admin-overridable: if target_sow_completion_days is set on the project, use it;
  // otherwise fall back to the category-based benchmark.
  const targetDays   = localProject?.target_sow_completion_days || getTargetDays(categoryName);

  const kickoffFromPlan = getKickoffDate(tasks);
  const kickoffDate     = localProject?.kickoff_date || kickoffFromPlan;
  const projectedGoLive = getProjectedGoLive(tasks) || localProject?.projected_go_live;
  const plannedGoLive   = kickoffDate ? addWorkdays(new Date(kickoffDate), targetDays) : null;

  const workCompleted          = kickoffDate ? networkdays(new Date(kickoffDate), today()) : 0;
  const projectedOnboardingDays = projectedGoLive && kickoffDate
    ? networkdays(new Date(kickoffDate), new Date(projectedGoLive)) : null;
  const daysRemaining = plannedGoLive
    ? Math.max(0, networkdays(today(), new Date(plannedGoLive)) - 1) : null;

  // Delay Days from "Release System" task
  const releaseTask = tasks.find(t => t.activities?.toLowerCase().includes('release system'));
  const delayDays   = (releaseTask?.baseline_planned_end && releaseTask?.planned_end)
    ? Math.max(0, networkdays(parseDate(releaseTask.baseline_planned_end), parseDate(releaseTask.planned_end)) - 1)
    : null;

  // SOW denominator: first task planned_start → projected go-live (consistent with elapsed days start)
  // This ensures numerator (elapsed from first task) and denominator share the same reference point.
  const firstTaskDate = tasks.length > 0
    ? new Date(Math.min(...tasks.filter(t => t.planned_start).map(t => parseDate(t.planned_start).getTime())))
    : null;
  const sowDenominator = projectedGoLive && firstTaskDate
    ? networkdays(firstTaskDate, new Date(projectedGoLive))
    : projectedOnboardingDays || targetDays;

  // SOW — use sowDenominator (first task → go-live) so elapsed and denominator share the same start
  const sowCompletion = calcSOWCompletion(tasks, sowDenominator);
  const currentSOW    = sowCompletion?.current  ?? 0;
  const expectedSOW   = sowCompletion?.expected ?? 0;
  const sowDelta      = currentSOW - expectedSOW;

  const isDelayed   = projectedGoLive && plannedGoLive && new Date(projectedGoLive) > new Date(plannedGoLive);
  // Status badge is driven by SOW delta (same signal shown in the SOW completion bars), not Release System delay days
  const statusLabel = !kickoffDate ? 'Not Started' : (sowDelta < 0 ? 'Delayed' : 'On Track');
  const statusStyle = {
    'On Track':   'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Delayed':    'bg-red-100 text-red-700 border-red-200',
    'Not Started':'bg-slate-100 text-slate-600 border-slate-200',
  }[statusLabel];

  const todayISO    = toDateStr(today());
  const todayTasks  = useMemo(() =>
    // Show tasks whose planned_start is today — tasks that are due to begin today
    tasks.filter(t =>
      t.planned_start === todayISO &&
      t.status !== 'Done' &&
      t.status !== 'Not Applicable'
    ),
    [tasks, todayISO]
  );
  const urgentTasks = useMemo(() => {
    const todayDate = today();
    return tasks.filter(t => {
      if (t.status === 'Done' || t.status === 'Not Applicable') return false;

      // Primary: use the recalculated days_delay (covers most cases)
      if (typeof t.days_delay === 'number' && t.days_delay > 10) return true;

      // Fallback: compare baseline_planned_end directly vs today.
      // This catches "In Progress" tasks whose planned_end was cascade-pushed to a
      // future date before the user marked them In Progress — in that case the DB
      // stores a future planned_end so calcDaysDelay returns 0, but the task is
      // still delayed vs its original baseline schedule.
      const baselineEnd = t.baseline_planned_end ? parseDate(t.baseline_planned_end) : null;
      if (baselineEnd && baselineEnd < todayDate) {
        const delayVsBaseline = Math.max(0, networkdays(baselineEnd, todayDate) - 1);
        if (delayVsBaseline > 10) return true;
      }

      return false;
    });
  }, [tasks]);

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
    <div className="p-5 max-w-7xl">
    {/* Outer flex: main content left, Today's Activities pinned to the right */}
    <div className="flex gap-4 items-start">

    {/* ── LEFT: all metrics, SOW, urgent actions ── */}
    <div className="flex-1 min-w-0 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Project Health</h1>
          <p className="text-xs text-slate-500 mt-0.5">{localProject.name}{categoryName ? ` · ${categoryName}` : ''}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusStyle}`}>{statusLabel}</span>
      </div>

      {/* ── Row 1: Target SOW Days · PO Date · Kickoff Date · Planned Go-Live ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={Target} iconColor="text-indigo-600" bg="bg-indigo-50 border-indigo-100" accent="bg-indigo-100"
          label="Target SOW Days" value={`${targetDays}d`}
          sub={localProject?.target_sow_completion_days ? 'Custom override' : `${categoryName || 'Default'} benchmark`}
          editable={canEdit}
          onEdit={() => { setEditing('target_sow_completion_days'); setEditVal(String(targetDays)); }}
          editing={editing === 'target_sow_completion_days'}
          editValue={editVal} onEditChange={setEditVal} type="number"
          onSave={() => saveField('target_sow_completion_days', parseInt(editVal) || null)}
          onCancel={() => setEditing(null)}
        />
        <StatCard icon={Calendar} iconColor="text-slate-500" bg="bg-slate-50 border-slate-200" accent="bg-slate-100"
          label="PO Date" value={fmtDate(localProject?.po_date)}
          editable={canEdit} editing={editing === 'po_date'} editValue={editVal} type="date"
          onEdit={() => { setEditing('po_date'); setEditVal(localProject?.po_date || ''); }}
          onEditChange={setEditVal} onSave={() => saveField('po_date', editVal)} onCancel={() => setEditing(null)}
        />
        <StatCard icon={Calendar} iconColor="text-violet-600" bg="bg-violet-50 border-violet-100" accent="bg-violet-100"
          label="Kickoff Date" value={fmtDate(kickoffDate)}
          sub={kickoffFromPlan && !localProject?.kickoff_date ? 'From plan' : 'Manual'}
          editable={canEdit} editing={editing === 'kickoff_date'} editValue={editVal} type="date"
          onEdit={() => { setEditing('kickoff_date'); setEditVal(kickoffDate ? formatDateInput(new Date(kickoffDate)) : ''); }}
          onEditChange={setEditVal} onSave={() => saveField('kickoff_date', editVal)} onCancel={() => setEditing(null)}
        />
        <StatCard icon={TrendingUp} iconColor="text-green-600" bg="bg-green-50 border-green-100" accent="bg-green-100"
          label="Planned Go-Live" value={fmtDate(plannedGoLive)}
          sub={kickoffDate ? `Kickoff + ${targetDays}d` : 'Awaiting kickoff'}
        />
      </div>

      {/* ── Rows 2 & 3 + Risk/Issue sidebar ── */}
      <div className="flex gap-3 items-start">

        {/* Left: rows 2 & 3 stacked */}
        <div className="flex-1 space-y-3">

          {/* Row 2: Onboarding Days · Projected Go-Live */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Clock} iconColor="text-orange-600" bg="bg-orange-50 border-orange-100" accent="bg-orange-100"
              label="Project Onboarding Days" value={projectedOnboardingDays ? `${projectedOnboardingDays}d` : '—'}
              sub="Kickoff → Projected go-live"
            />
            <StatCard icon={TrendingUp} iconColor="text-blue-600" bg="bg-blue-50 border-blue-100" accent="bg-blue-100"
              label="Projected Go-Live" value={fmtDate(projectedGoLive)} sub="From Release System task"
            />
          </div>

          {/* Row 3: Work Completed · Days Remaining · Delay Days */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={TrendingUp} iconColor="text-teal-600" bg="bg-teal-50 border-teal-100" accent="bg-teal-100"
              label="Work Completed" value={workCompleted ? `${workCompleted}d` : '—'}
              sub={kickoffDate ? `Since ${fmtDate(kickoffDate)}` : 'Awaiting kickoff'}
            />
            <StatCard icon={Clock} iconColor="text-pink-600" bg="bg-pink-50 border-pink-100" accent="bg-pink-100"
              label="Days Remaining" value={daysRemaining !== null ? `${daysRemaining}d` : '—'}
              sub="Until planned go-live"
            />
            <div className={`rounded-xl border p-3 flex flex-col gap-1.5 ${
              delayDays === null ? 'bg-slate-50 border-slate-200'
              : delayDays > 0   ? 'bg-red-50 border-red-100'
              : 'bg-emerald-50 border-emerald-100'
            }`}>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                delayDays === null ? 'bg-slate-100' : delayDays > 0 ? 'bg-red-100' : 'bg-emerald-100'
              }`}>
                {delayDays > 0
                  ? <TrendingDown size={13} className="text-red-600" />
                  : <TrendingUp   size={13} className={delayDays === null ? 'text-slate-400' : 'text-emerald-600'} />
                }
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium leading-none mb-0.5">Delay Days</p>
                <p className={`text-sm font-bold leading-tight ${
                  delayDays === null ? 'text-slate-400' : delayDays > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}>
                  {delayDays === null ? '—' : delayDays > 0 ? `+${delayDays}d` : '0d'}
                </p>
                {releaseTask && <p className="text-[9px] text-slate-400 mt-0.5">Release System</p>}
              </div>
            </div>
          </div>

        </div>

        {/* Right sidebar: Risks + Issues */}
        <div className="w-36 flex flex-col gap-3 shrink-0">
          <CountBox icon={AlertTriangle}
            count={openRisks} label="Open Risks"
            bg="bg-amber-50 border border-amber-200"
            iconBg="bg-amber-100" iconColor="text-amber-600" textColor="text-amber-700"
          />
          <CountBox icon={Activity}
            count={openIssues} label="Open Issues"
            bg="bg-red-50 border border-red-200"
            iconBg="bg-red-100" iconColor="text-red-600" textColor="text-red-700"
          />
        </div>

      </div>

      {/* ── SOW Completion ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Projected SOW Completion %</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Denominator: {sowDenominator ? `${sowDenominator}d` : `${targetDays}d`} projected days (first task → go-live)
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border ${
            sowDelta >= 0
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : sowDelta >= -10
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {sowDelta >= 0 ? <TrendingUp size={11} /> : sowDelta >= -10 ? <Minus size={11} /> : <TrendingDown size={11} />}
            {sowDelta >= 0 ? `+${sowDelta.toFixed(1)}% ahead` : `${Math.abs(sowDelta).toFixed(1)}% behind`}
          </span>
        </div>
        <div className="space-y-2.5">
          <MiniBar label="Current %"  percent={currentSOW}  colorClass="bg-emerald-500" textClass="text-emerald-700" />
          <MiniBar label="Expected %" percent={expectedSOW} colorClass="bg-blue-400"    textClass="text-blue-600" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-emerald-500 inline-block" /> Current: overlap-adjusted weight of Done tasks</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-blue-400 inline-block" /> Expected: elapsed days / projected onboarding days</span>
        </div>
      </div>

      {/* ── DM Action Items — full width below SOW, dynamic rows ── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800">DM Action Items</h3>
          <span className="text-[10px] text-slate-400">from daily call</span>
          <button
            onClick={() => {
              const updated = [...dmActions, { text: '', byWhen: '', status: 'Not Started', impact: '' }];
              setDmActions(updated);
              try { localStorage.setItem(dmActionsKey, JSON.stringify(updated)); } catch {}
            }}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg border border-amber-200 transition font-medium"
          >
            <Plus size={10}/> Add Row
          </button>
        </div>
        {/* Column headers */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="w-6 shrink-0" />
          <span className="flex-1 text-[10px] text-slate-400 font-medium">Action Item</span>
          <span className="w-28 shrink-0 text-[10px] text-slate-400 font-medium">Status</span>
          <span className="w-28 shrink-0 text-[10px] text-slate-400 font-medium">Due Date</span>
          <span className="w-40 shrink-0 text-[10px] text-slate-400 font-medium">Impact / Effect</span>
        </div>
        <div className="space-y-2">
          {dmActions.map((action, i) => {
            const updateField = (field, val) => {
              const updated = dmActions.map((a, idx) => idx === i ? { ...a, [field]: val } : a);
              setDmActions(updated);
              try { localStorage.setItem(dmActionsKey, JSON.stringify(updated)); } catch {}
            };
            const deleteRow = () => {
              const updated = dmActions.filter((_, idx) => idx !== i);
              const final = updated.length ? updated : [{ text: '', byWhen: '', status: 'Not Started', impact: '' }];
              setDmActions(final);
              setDmMenuOpen(null);
              try { localStorage.setItem(dmActionsKey, JSON.stringify(final)); } catch {}
            };
            const statusColors = {
              'Not Started': 'bg-gray-100 text-gray-600',
              'In Progress': 'bg-amber-100 text-amber-700',
              'Done': 'bg-emerald-100 text-emerald-700',
            };
            return (
              <div key={i} className="flex items-center gap-2">
                {/* Three-dots menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setDmMenuOpen(dmMenuOpen === i ? null : i)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition rounded"
                    title="Row options"
                  >
                    <MoreVertical size={13}/>
                  </button>
                  {dmMenuOpen === i && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setDmMenuOpen(null)} />
                      <div className="absolute left-0 top-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-24">
                        <button
                          onClick={deleteRow}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Action text — textarea so Shift+Enter inserts a new line */}
                <textarea
                  value={action.text}
                  onChange={e => updateField('text', e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault(); // plain Enter does nothing
                  }}
                  placeholder="Action item… (Shift+Enter for new line)"
                  rows={Math.max(1, (action.text || '').split('\n').length)}
                  className="flex-1 text-xs px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-800 placeholder-slate-400 bg-white resize-none overflow-hidden"
                />
                {/* Status */}
                <select
                  value={action.status || 'Not Started'}
                  onChange={e => updateField('status', e.target.value)}
                  className={`w-28 shrink-0 text-xs px-1.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white font-medium ${statusColors[action.status] || 'text-slate-700'}`}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
                {/* By When */}
                <input
                  type="date"
                  value={action.byWhen}
                  onChange={e => updateField('byWhen', e.target.value)}
                  className="w-28 shrink-0 text-xs px-2 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-700 bg-white"
                />
                {/* Impact / Effect */}
                <input
                  type="text"
                  value={action.impact || ''}
                  onChange={e => updateField('impact', e.target.value)}
                  placeholder="Impact / effect observed…"
                  className="w-40 shrink-0 text-xs px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-800 placeholder-slate-400 bg-white"
                />
              </div>
            );
          })}
        </div>
      </div>

    </div>{/* end LEFT column */}

    {/* ── RIGHT: Today's Activities + Needs Immediate Action stacked, sticky, viewport-height ── */}
    {/* Use height (not maxHeight) so that percentage-based flex children resolve correctly */}
    <div className="w-64 shrink-0 sticky top-4 flex flex-col gap-3" style={{ height: 'calc(100vh - 5rem)' }}>

      {/* Today's Activities — capped at 40% of the column height, scrollable inside */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '40%' }}>
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <CalendarDays size={14} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">Today's Activities</h3>
          {todayTasks.length > 0 && (
            <span className="ml-auto bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{todayTasks.length}</span>
          )}
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No activities due today.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
            {todayTasks.map(t => (
              <div key={t.id} className="bg-white rounded-lg p-2.5 border border-blue-100">
                <p className="text-xs font-medium text-slate-800 leading-snug">{t.activities}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{fmtDate(t.planned_end)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Needs Immediate Action — takes remaining height, scrollable inside */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col min-h-0 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={14} className="text-red-500" />
          <h3 className="text-sm font-semibold text-slate-800">Needs Immediate Action</h3>
          {urgentTasks.length > 0 && (
            <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{urgentTasks.length}</span>
          )}
        </div>
        {urgentTasks.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No activities need immediate attention.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
            {urgentTasks.map(t => {
              // Best delay figure: prefer recalculated days_delay, fall back to baseline diff
              const todayDate = today();
              const baselineEnd = t.baseline_planned_end ? parseDate(t.baseline_planned_end) : null;
              const baselineDelay = baselineEnd && baselineEnd < todayDate
                ? Math.max(0, networkdays(baselineEnd, todayDate) - 1) : 0;
              const displayDelay = (typeof t.days_delay === 'number' && t.days_delay > 0)
                ? t.days_delay : baselineDelay;
              return (
                <div key={t.id} className="bg-white rounded-lg p-2.5 border border-red-100">
                  <p className="text-xs font-medium text-slate-800 leading-snug">{t.activities}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      t.status === 'Not Started' ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'
                    }`}>{t.status}</span>
                    {displayDelay > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">+{displayDelay}d delay</span>
                    )}
                    {t.planned_end && (
                      <span className="text-[10px] text-slate-400">Due {fmtDate(t.planned_end)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>

    </div>{/* end outer flex */}
    </div>
  );
}
