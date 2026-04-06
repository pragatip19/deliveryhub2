import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const APP_URL = 'https://deliveryhub2-igqt.vercel.app';

const VIEWS = [
  { id: 'active',            label: 'Active Onboarding Deals',  stages: ['Ready for Onboarding', 'Under Onboarding'] },
  { id: 'closed_won',        label: 'Closed Won',               stages: ['Closed Won'] },
  { id: 'ready',             label: 'Ready for Onboarding',     stages: ['Ready for Onboarding'] },
  { id: 'under_onboarding',  label: 'Under Onboarding',         stages: ['Under Onboarding'] },
  { id: 'live_scaleup',      label: 'Live Under Scaleup',       stages: ['Live Under Scaleup'] },
];

const COLS = [
  { key: 'deal_name',           label: 'Deal Name',                        width: 200 },
  { key: 'gap_pct',             label: 'Expected − Actual (%)',            width: 150, numeric: true },
  { key: 'go_live_date',        label: 'Go Live Date',                     width: 120 },
  { key: 'delivery_plan_url',   label: 'Delivery Plan',                    width: 110 },
  { key: 'delivery_context',    label: 'Delivery Context',                 width: 200, editable: true },
  { key: 'critical_next',       label: 'Critical Next Actions',            width: 200 },
  { key: 'sow_expected_pct',    label: 'Expected SOW (%)',                 width: 130, numeric: true },
  { key: 'sow_current_pct',     label: 'Current SOW (%)',                  width: 130, numeric: true },
  { key: 'dm_name',             label: 'Delivery Manager',                 width: 150 },
  { key: 'po_date',             label: 'PO Date',                          width: 110 },
  { key: 'close_date',          label: 'Close Date',                       width: 110 },
  { key: 'kickoff_date',        label: 'Kickoff Date',                     width: 110 },
  { key: 'target_sow_days',     label: 'Target SOW Days',                  width: 130, numeric: true },
  { key: 'actual_onboarding',   label: 'Actual Onboarding Days',           width: 160, numeric: true },
  { key: 'product',             label: 'Product',                          width: 150 },
  { key: 'deal_stage_label',    label: 'Deal Stage',                       width: 160 },
];

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function networkdays(start, end) {
  let count = 0;
  const cur = new Date(start); cur.setHours(0,0,0,0);
  const fin = new Date(end);   fin.setHours(0,0,0,0);
  if (cur > fin) return 0;
  while (cur <= fin) { if (!isWeekend(cur)) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}

export default function HubSpotPage() {
  const { isAdmin } = useAuth();
  const navigate    = useNavigate();
  const admin       = isAdmin();

  const [deals,    setDeals]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [dmActions, setDmActions] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [activeView, setActiveView] = useState('active');
  const [sortCol, setSortCol]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');
  const [syncing, setSyncing]   = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { dealHsId, field }
  const [editVal, setEditVal]   = useState('');

  async function load() {
    setLoading(true);
    try {
      const [{ data: dealsData }, { data: projectsData }] = await Promise.all([
        supabase.from('hubspot_deals').select('*').order('synced_at', { ascending: false }),
        supabase.from('projects').select(
          'id,name,hubspot_deal_id,sow_current_pct,sow_expected_pct,' +
          'projected_go_live,kickoff_date,target_sow_completion_days,' +
          'delivery_context,dm_id,profiles!projects_dm_id_fkey(full_name)'
        ).not('hubspot_deal_id', 'is', null),
      ]);

      setDeals(dealsData || []);
      setProjects(projectsData || []);

      // Load first pending DM action per project
      if (projectsData?.length) {
        const ids = projectsData.map(p => p.id);
        const { data: actions } = await supabase
          .from('dm_actions')
          .select('project_id,text,status,by_when')
          .in('project_id', ids)
          .neq('status', 'Done')
          .order('sort_order');
        // Group by project_id, keep first
        const map = {};
        for (const a of (actions || [])) {
          if (!map[a.project_id]) map[a.project_id] = a;
        }
        setDmActions(map);
      }
    } catch (err) {
      toast.error('Failed to load HubSpot data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Merge deals with project data
  const rows = useMemo(() => {
    const projMap = Object.fromEntries(projects.map(p => [p.hubspot_deal_id, p]));
    return deals.map(deal => {
      const proj = projMap[deal.hs_object_id] || null;
      const kickoff     = proj?.kickoff_date || null;
      const projGoLive  = proj?.projected_go_live || null;
      const actualOnboarding = kickoff && projGoLive
        ? networkdays(new Date(kickoff), new Date(projGoLive))
        : null;
      const gapPct = (proj?.sow_expected_pct != null && proj?.sow_current_pct != null)
        ? Math.round((proj.sow_expected_pct - proj.sow_current_pct) * 10) / 10
        : null;
      const action = proj ? dmActions[proj.id] : null;

      return {
        ...deal,
        project_id:       proj?.id || null,
        sow_current_pct:  proj?.sow_current_pct ?? null,
        sow_expected_pct: proj?.sow_expected_pct ?? null,
        go_live_date:     projGoLive,
        kickoff_date:     kickoff,
        target_sow_days:  proj?.target_sow_completion_days ?? null,
        actual_onboarding: actualOnboarding,
        delivery_context: proj?.delivery_context || '',
        dm_name:          proj?.profiles?.full_name || '—',
        gap_pct:          gapPct,
        critical_next:    action?.text || null,
        delivery_plan_url: proj ? `${APP_URL}/project/${proj.id}/plan` : null,
      };
    });
  }, [deals, projects, dmActions]);

  // Filter by view
  const viewDef   = VIEWS.find(v => v.id === activeView);
  const filtered  = useMemo(() => {
    const stages = viewDef?.stages || [];
    return rows.filter(r => stages.includes(r.deal_stage_label));
  }, [rows, viewDef]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1  : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]);

  function handleSort(key) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/hubspot-sync');
      const data = await res.json();
      if (res.ok) {
        toast.success(`Synced ${data.deals?.length || 0} deals`);
        await load();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  }

  async function saveDeliveryContext(hsId, projectId, val) {
    if (!projectId) return;
    const { error } = await supabase
      .from('projects')
      .update({ delivery_context: val })
      .eq('id', projectId);
    if (error) { toast.error('Failed to save'); return; }
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, delivery_context: val } : p
    ));
    setEditingCell(null);
    toast.success('Saved');
  }

  function cellValue(row, col) {
    switch (col.key) {
      case 'deal_name':
        return (
          <span
            className="font-medium text-blue-700 cursor-pointer hover:underline"
            onClick={() => row.project_id && navigate(`/project/${row.project_id}/health`)}
          >
            {row.deal_name || '—'}
          </span>
        );
      case 'gap_pct':
        if (row.gap_pct === null) return <span className="text-slate-300">—</span>;
        return (
          <span className={`font-semibold ${row.gap_pct > 10 ? 'text-red-600' : row.gap_pct > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {row.gap_pct > 0 ? `+${row.gap_pct}%` : `${row.gap_pct}%`}
          </span>
        );
      case 'go_live_date':   return fmtDate(row.go_live_date);
      case 'delivery_plan_url':
        return row.delivery_plan_url
          ? <a href={row.delivery_plan_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><ExternalLink size={12}/> Plan</a>
          : <span className="text-slate-300">—</span>;
      case 'delivery_context':
        if (admin && editingCell?.hsId === row.hs_object_id) {
          return (
            <textarea
              autoFocus
              className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 resize-none"
              rows={2}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={() => saveDeliveryContext(row.hs_object_id, row.project_id, editVal)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDeliveryContext(row.hs_object_id, row.project_id, editVal); } }}
            />
          );
        }
        return (
          <span
            className={`block truncate ${admin ? 'cursor-pointer hover:bg-amber-50 rounded px-1' : ''} ${row.delivery_context ? '' : 'text-slate-300 italic'}`}
            onClick={() => { if (admin && row.project_id) { setEditingCell({ hsId: row.hs_object_id }); setEditVal(row.delivery_context || ''); } }}
          >
            {row.delivery_context || (admin ? 'Click to add…' : '—')}
          </span>
        );
      case 'critical_next':
        return row.critical_next
          ? <span className="truncate block text-slate-700">{row.critical_next}</span>
          : <span className="text-slate-300">—</span>;
      case 'sow_expected_pct': return row.sow_expected_pct != null ? `${row.sow_expected_pct}%` : '—';
      case 'sow_current_pct':  return row.sow_current_pct  != null ? `${row.sow_current_pct}%`  : '—';
      case 'po_date':          return fmtDate(row.po_date);
      case 'close_date':       return fmtDate(row.close_date);
      case 'kickoff_date':     return fmtDate(row.kickoff_date);
      case 'target_sow_days':  return row.target_sow_days != null ? `${row.target_sow_days}d` : '—';
      case 'actual_onboarding':return row.actual_onboarding != null ? `${row.actual_onboarding}d` : '—';
      case 'product':          return row.product || '—';
      case 'dm_name':          return row.dm_name || '—';
      case 'deal_stage_label': return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          row.deal_stage_label === 'Closed Won'          ? 'bg-emerald-100 text-emerald-700' :
          row.deal_stage_label === 'Ready for Onboarding'? 'bg-blue-100 text-blue-700' :
          row.deal_stage_label === 'Under Onboarding'    ? 'bg-amber-100 text-amber-700' :
          row.deal_stage_label === 'Live Under Scaleup'  ? 'bg-purple-100 text-purple-700' :
          'bg-slate-100 text-slate-600'
        }`}>
          {row.deal_stage_label || '—'}
        </span>
      );
      default: return row[col.key] ?? '—';
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">HubSpot</h1>
          <p className="text-xs text-slate-500 mt-0.5">Deal pipeline synced from HubSpot CRM</p>
        </div>
        {admin && (
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        )}
      </div>

      {/* View tabs */}
      <div className="px-6 pt-3 bg-white border-b border-gray-200 flex gap-1">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
              activeView === v.id
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {v.label}
            <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {rows.filter(r => (VIEWS.find(x => x.id === v.id)?.stages || []).includes(r.deal_stage_label)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <p>No deals found for this view.</p>
            {admin && <p className="text-xs">Click "Sync Now" to pull latest deals from HubSpot.</p>}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    {COLS.map(col => (
                      <th
                        key={col.key}
                        style={{ minWidth: col.width, maxWidth: col.width }}
                        className="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key
                            ? sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
                            : null
                          }
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((row, i) => (
                    <tr key={row.hs_object_id || i} className="hover:bg-slate-50 transition-colors">
                      {COLS.map(col => (
                        <td
                          key={col.key}
                          style={{ minWidth: col.width, maxWidth: col.width }}
                          className="px-3 py-2.5 text-slate-700 overflow-hidden"
                        >
                          {cellValue(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
