import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, MoreVertical, Filter, ArrowUpDown, X, ChevronDown, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getProjects, getMyProjects, updateProject, deleteProject, duplicateProject, getAllProfiles, getCategories, getPlanTasks } from '../../lib/supabase';
import { addWorkdays, networkdays } from '../../lib/workdays';
import { calcSOWCompletion, getKickoffDate, getProjectedGoLive, recalculatePlan } from '../../lib/calculations';
import NewProjectModal from './NewProjectModal';
import toast from 'react-hot-toast';

const DEAL_STATUS_OPTIONS = ['Ready for Onboarding', 'Under Onboarding', 'Live-Under Scaleup'];

const DEAL_STATUS_COLORS = {
  'Ready for Onboarding': 'bg-blue-100 text-blue-700',
  'Under Onboarding': 'bg-yellow-100 text-yellow-700',
  'Live-Under Scaleup': 'bg-green-100 text-green-700',
};

const PROJECT_STATUS_COLORS = {
  'On Track': 'bg-emerald-100 text-emerald-700',
  'Delayed': 'bg-red-100 text-red-700',
  'Not Started': 'bg-slate-100 text-slate-600',
};

function getProjectStatus(project) {
  if (!project.planned_go_live) return 'Not Started';
  if (project.projected_go_live && project.planned_go_live) {
    return new Date(project.projected_go_live) > new Date(project.planned_go_live) ? 'Delayed' : 'On Track';
  }
  return 'Not Started';
}

function getCategoryTargetDays(categoryName) {
  if (!categoryName) return 72;
  const n = categoryName.toLowerCase();
  if (n === 'cleen') return 36;
  if (n.includes('logbook')) return 60;
  return 72;
}

function getProjectHealth(project) {
  const { kickoff_date, projected_go_live, category_name } = project;
  if (!kickoff_date) return { status: 'Not Started', delayDays: 0, expectedPct: 0 };

  const targetDays  = getCategoryTargetDays(category_name);
  const kickoff     = new Date(kickoff_date);
  const plannedGoLive = addWorkdays(kickoff, targetDays);   // same formula as ProjectHealth tab
  const todayDate   = new Date();

  // expected % = workdays elapsed / total workdays (kickoff → planned go-live)
  const totalWd   = Math.max(1, networkdays(kickoff, plannedGoLive));
  const elapsedWd = Math.max(0, networkdays(kickoff, todayDate));
  const expectedPct = Math.min(100, Math.round((elapsedWd / totalWd) * 100));

  let delayDays = 0;
  let status    = 'On Track';
  if (projected_go_live) {
    const proj = new Date(projected_go_live);
    if (proj > plannedGoLive) {
      // match ProjectHealth: networkdays between baseline and projected
      delayDays = Math.max(0, networkdays(plannedGoLive, proj) - 1);
      status = 'Delayed';
    }
  }
  return { status, delayDays, expectedPct };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── Edit Project Modal ────────────────────────────────────────
function EditProjectModal({ project, onClose, onSaved, dmProfiles, categories, canChangeAll }) {
  const [form, setForm] = useState({
    name: project.name || '',
    deal_status: project.deal_status || 'Ready for Onboarding',
    category_id: project.category_id || '',
    dm_id: project.dm_id || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: form.name.trim(),
        deal_status: form.deal_status,
        ...(canChangeAll && { category_id: form.category_id, dm_id: form.dm_id }),
      });
      toast.success('Project updated');
      onSaved();
      onClose();
    } catch { toast.error('Failed to update'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 mb-5">Edit Project</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deal Stage</label>
            <select value={form.deal_status} onChange={e => setForm(p => ({ ...p, deal_status: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              {DEAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {canChangeAll && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Application</label>
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Manager</label>
                <select value={form.dm_id} onChange={e => setForm(p => ({ ...p, dm_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {dmProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────
function ProjectCard({ project, canEdit, canDelete, onEdit, onDelete, onDuplicate, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [sowData, setSowData]               = useState(null);
  const [taskKickoff, setTaskKickoff]       = useState(null); // kickoff derived from tasks
  const [taskProjGoLive, setTaskProjGoLive] = useState(null); // projected go-live from Release System task

  useEffect(() => {
    function handleClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load tasks — derive kickoff, projected go-live, and SOW completion exactly like ProjectHealth
  useEffect(() => {
    if (!project?.id) return;
    getPlanTasks(project.id).then(rawTasks => {
      if (!rawTasks?.length) return;
      // Run recalculatePlan so planned_end, days_delay, etc. match the Health page
      const tasks = recalculatePlan(rawTasks);
      const kickoffStr   = project.kickoff_date || getKickoffDate(tasks);
      const projGoLiveStr = getProjectedGoLive(tasks) || project.projected_go_live;
      setTaskKickoff(kickoffStr || null);
      setTaskProjGoLive(projGoLiveStr || null);

      // Match Health page: derive denominator from actual task span (first task → go-live)
      // calcSOWCompletion uses actualSpanDays when targetDays is null — same as Health page
      setSowData(calcSOWCompletion(tasks, null));
    }).catch(() => {});
  }, [project?.id]);

  const goLiveDate = taskProjGoLive || project.projected_go_live || project.planned_go_live;
  const currentSOW = sowData?.current  ?? 0;
  const expectedSOW = sowData?.expected ?? 0;
  const sowDelta   = currentSOW - expectedSOW;
  // "Not Started" = Release System task has no projected go-live yet (plan not kicked off)
  const hasProjectedGoLive = !!(taskProjGoLive || project.projected_go_live);

  // Go-live on-track / delayed: compare projected go-live vs kickoff + target days
  const targetDaysForGoLive = project.target_sow_completion_days || getCategoryTargetDays(project.category_name);
  const plannedGoLiveDate = taskKickoff ? addWorkdays(new Date(taskKickoff), targetDaysForGoLive) : null;
  const isGoLiveDelayed = !!(plannedGoLiveDate && taskProjGoLive &&
    new Date(taskProjGoLive) > plannedGoLiveDate);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onNavigate(project.id)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-base font-semibold text-slate-900 truncate mb-1">{project.name}</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {project.category_name || '—'}
            </span>
            {hasProjectedGoLive && (
              isGoLiveDelayed ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  <AlertCircle size={9} /> Go-Live Delayed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 size={9} /> Go-Live On Track
                </span>
              )
            )}
          </div>
        </div>
        {canEdit && (
          <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(o => !o)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-48 py-1">
                <button onClick={() => { setMenuOpen(false); onEdit(project); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Edit Project
                </button>
                <button onClick={() => { setMenuOpen(false); onDuplicate(project); }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Copy size={13} className="text-slate-400" /> Duplicate Project
                </button>
                {canDelete && (
                  <button onClick={() => { setMenuOpen(false); onDelete(project); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    Delete Project
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Projected SOW Completion % status badge */}
      <div className="mb-4">
        <p className="text-[10px] text-slate-400 mb-1 font-medium">Projected SOW Completion %</p>
        {!hasProjectedGoLive ? (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
            Not Started
          </span>
        ) : !sowData ? (
          <span className="text-xs text-slate-300">Loading…</span>
        ) : sowDelta < 0 ? (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
            {Math.abs(sowDelta).toFixed(1)}% behind
          </span>
        ) : (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            {sowDelta > 0.5 ? `+${sowDelta.toFixed(1)}% ahead` : 'On Track'}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">DM</span>
          <span className="font-medium text-slate-800 truncate max-w-[60%] text-right">{project.dm_name || 'Unassigned'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Deal Stage</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEAL_STATUS_COLORS[project.deal_status] || 'bg-slate-100 text-slate-600'}`}>
            {project.deal_status || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Go-Live</span>
          <span className="font-medium text-slate-800">{fmtDate(goLiveDate)}</span>
        </div>
        {project.kickoff_date && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Kickoff</span>
            <span className="font-medium text-slate-800">{fmtDate(project.kickoff_date)}</span>
          </div>
        )}
      </div>

      <button onClick={e => { e.stopPropagation(); onNavigate(project.id); }}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
        View Project
      </button>
    </div>
  );
}

// ── Main HubPage ──────────────────────────────────────────────
export default function HubPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isDM, isLeadership } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [viewMode, setViewMode] = useState('my');
  const [editProject, setEditProject] = useState(null);

  async function handleDeleteProject(project) {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
      toast.success('Project deleted');
      loadAll();
    } catch { toast.error('Failed to delete project'); }
  }

  async function handleDuplicateProject(project) {
    const suggestedName = `Copy of ${project.name}`;
    const newName = window.prompt('Name for the duplicate project:', suggestedName);
    if (!newName?.trim()) return;
    const toastId = toast.loading('Duplicating project…');
    try {
      await duplicateProject(project.id, newName.trim());
      toast.success('Project duplicated!', { id: toastId });
      loadAll();
    } catch (e) {
      toast.error('Failed to duplicate: ' + (e?.message || ''), { id: toastId });
    }
  }
  const [dmProfiles, setDmProfiles] = useState([]);
  const [categories, setCategories] = useState([]);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDealStage, setFilterDealStage] = useState('');
  const [filterDM, setFilterDM] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGoLiveFrom, setFilterGoLiveFrom] = useState('');
  const [filterGoLiveTo, setFilterGoLiveTo] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');

  const isAdminOrDm = isAdmin() || isDM();
  const showViewToggle = isDM();
  const shouldShowAllProjects = isAdmin() || isLeadership() || viewMode === 'all';

  useEffect(() => { loadAll(); }, [viewMode, shouldShowAllProjects]);

  async function loadAll() {
    setLoading(true);
    try {
      const [data, profs, cats] = await Promise.all([
        shouldShowAllProjects ? getProjects() : getMyProjects(user?.id),
        getAllProfiles(),
        getCategories(),
      ]);
      setProjects(data || []);
      setDmProfiles(profs || []);
      setCategories(cats || []);
    } catch { toast.error('Failed to load projects'); }
    setLoading(false);
  }

  const activeFilterCount = [filterDealStage, filterDM, filterApp, filterStatus, filterGoLiveFrom, filterGoLiveTo].filter(Boolean).length;

  function clearFilters() {
    setFilterDealStage(''); setFilterDM(''); setFilterApp('');
    setFilterStatus(''); setFilterGoLiveFrom(''); setFilterGoLiveTo('');
  }

  const filtered = useMemo(() => {
    let list = [...projects];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.dm_name || '').toLowerCase().includes(q));
    }
    if (filterDealStage) list = list.filter(p => p.deal_status === filterDealStage);
    if (filterDM) list = list.filter(p => p.dm_id === filterDM);
    if (filterApp) list = list.filter(p => p.category_name === filterApp);
    if (filterStatus) list = list.filter(p => getProjectStatus(p) === filterStatus);
    if (filterGoLiveFrom) list = list.filter(p => p.planned_go_live && p.planned_go_live >= filterGoLiveFrom);
    if (filterGoLiveTo) list = list.filter(p => p.planned_go_live && p.planned_go_live <= filterGoLiveTo);

    list.sort((a, b) => {
      let va = a[sortBy] || '';
      let vb = b[sortBy] || '';
      if (sortBy === 'name' || sortBy === 'dm_name' || sortBy === 'deal_status' || sortBy === 'category_name') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
    });

    return list;
  }, [projects, searchQuery, filterDealStage, filterDM, filterApp, filterStatus, filterGoLiveFrom, filterGoLiveTo, sortBy, sortDir]);

  const uniqueApps = [...new Set(projects.map(p => p.category_name).filter(Boolean))];
  const uniqueDMs = dmProfiles.filter(p => projects.some(pr => pr.dm_id === p.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-slate-900">DeliveryHub</h1>
        <div className="flex items-center gap-3">
          {showViewToggle && (
            <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
              {['my', 'all'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                  {mode === 'my' ? 'My Projects' : 'All Projects'}
                </button>
              ))}
            </div>
          )}
          {isAdminOrDm && (
            <button onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm">
              <Plus size={18} /> New Project
            </button>
          )}
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects or DMs..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-900" />
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
          <Filter size={15} />
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        {/* Sort */}
        <div className="flex items-center gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="updated_at">Last Updated</option>
            <option value="created_at">Date Created</option>
            <option value="name">Name</option>
            <option value="planned_go_live">Go-Live Date</option>
            <option value="dm_name">DM</option>
            <option value="deal_status">Deal Stage</option>
            <option value="category_name">Application</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50">
            <ArrowUpDown size={15} />
          </button>
        </div>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Deal Stage</label>
            <select value={filterDealStage} onChange={e => setFilterDealStage(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">All</option>
              {DEAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Delivery Manager</label>
            <select value={filterDM} onChange={e => setFilterDM(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">All</option>
              {uniqueDMs.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Application</label>
            <select value={filterApp} onChange={e => setFilterApp(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">All</option>
              {uniqueApps.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">All</option>
              <option value="On Track">On Track</option>
              <option value="Delayed">Delayed</option>
              <option value="Not Started">Not Started</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Go-Live From</label>
            <input type="date" value={filterGoLiveFrom} onChange={e => setFilterGoLiveFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Go-Live To</label>
            <input type="date" value={filterGoLiveTo} onChange={e => setFilterGoLiveTo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-slate-500 mb-4">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</p>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No projects match your filters.</p>
          {activeFilterCount > 0 && <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm hover:underline">Clear filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              canEdit={isAdmin() || project.dm_id === profile?.id}
              canDelete={isAdmin()}
              onEdit={setEditProject}
              onDelete={handleDeleteProject}
              onDuplicate={handleDuplicateProject}
              onNavigate={id => navigate(`/project/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <NewProjectModal isOpen={showNewProjectModal} onClose={() => setShowNewProjectModal(false)} onProjectCreated={() => { setShowNewProjectModal(false); loadAll(); }} />

      {editProject && (
        <EditProjectModal
          project={editProject}
          canChangeAll={isAdmin()}
          dmProfiles={dmProfiles}
          categories={categories}
          onClose={() => setEditProject(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
