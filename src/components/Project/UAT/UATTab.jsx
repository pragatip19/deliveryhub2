import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, MoreVertical, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUATItems, upsertUATItem, deleteUATItem, getPeople } from '../../../lib/supabase';
import { UAT_STATUS_OPTIONS, UAT_BATCH_STATUS_OPTIONS } from '../../../lib/templates';
import { useAuth } from '../../../contexts/AuthContext';

// ── Color maps ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Not Started':    'bg-gray-100 text-gray-700',
  'Ready for UAT':  'bg-blue-100 text-blue-700',
  'In Progress':    'bg-yellow-100 text-yellow-800',
  'Under Reconfig': 'bg-orange-100 text-orange-700',
  'UAT Complete':   'bg-green-100 text-green-800',
  'Signed Off':     'bg-emerald-100 text-emerald-800',
};
const BATCH_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done':        'bg-emerald-100 text-emerald-700',
  'Blocked':     'bg-red-100 text-red-700',
};

const ColoredSelect = ({ value, options, colorMap, onChange, disabled }) => {
  const cls = colorMap[value] || 'bg-white text-gray-700';
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-1.5 py-0.5 rounded text-xs font-medium border border-gray-200 focus:outline-none focus:border-blue-400 ${cls}`}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

// ── MES UAT groups ────────────────────────────────────────────────────────────
const MES_GROUPS = ['BMR', 'BPR', 'Logbooks / Processes'];
const LOG_GROUPS = ['Logbooks / Processes'];

// ── Editable number cell ──────────────────────────────────────────────────────
const NumCell = ({ value, onChange, disabled }) => (
  <input
    type="number"
    value={value ?? ''}
    onChange={e => onChange(parseInt(e.target.value) || 0)}
    disabled={disabled}
    className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
    style={{ minWidth: 48 }}
  />
);

// ── Editable text cell ────────────────────────────────────────────────────────
const TextCell = ({ value, onChange, disabled, placeholder }) => (
  <input
    type="text"
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    placeholder={placeholder}
    className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
  />
);

export default function UATTab({ project, canEdit }) {
  const { user, isAdmin, isDM } = useAuth();
  const [uatItems, setUatItems] = useState([]);
  const [people, setPeople]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Global batch dates
  const [batchDates, setBatchDates] = useState({
    batch_1_start: '', batch_1_end: '',
    batch_2_start: '', batch_2_end: '',
    batch_3_start: '', batch_3_end: '',
  });

  const isMES      = project?.uat_type === 'mes';
  const isLogbooks = project?.uat_type === 'logbooks';
  const groups     = isMES ? MES_GROUPS : LOG_GROUPS;
  const canDelete  = isAdmin() || isDM();

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [items, peopleList] = await Promise.all([
          getUATItems(project.id),
          getPeople(project.id),
        ]);
        setUatItems(items || []);
        setPeople(peopleList || []);
        const cfg = (items || []).find(i => i.group_name === '__batch_config');
        if (cfg) setBatchDates({
          batch_1_start: cfg.batch_1_start || '',
          batch_1_end:   cfg.batch_1_end   || '',
          batch_2_start: cfg.batch_2_start || '',
          batch_2_end:   cfg.batch_2_end   || '',
          batch_3_start: cfg.batch_3_start || '',
          batch_3_end:   cfg.batch_3_end   || '',
        });
      } catch { toast.error('Failed to load UAT data'); }
      finally   { setLoading(false); }
    }
    if (project?.id) load();
  }, [project?.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const h = () => setOpenMenuId(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [openMenuId]);

  // ── Save helpers ─────────────────────────────────────────────────────────────
  const debouncedSave = useCallback(
    (() => {
      let t;
      return (item) => {
        clearTimeout(t);
        t = setTimeout(async () => {
          try { await upsertUATItem(project.id, item); }
          catch { toast.error('Failed to save UAT item'); }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleChange = useCallback((itemId, field, value) => {
    setUatItems(prev => {
      const next = prev.map(i => i.id === itemId ? { ...i, [field]: value } : i);
      const item = next.find(i => i.id === itemId);
      if (item) debouncedSave(item);
      return next;
    });
  }, [debouncedSave]);

  const handleBatchDateChange = useCallback((key, value) => {
    setBatchDates(prev => {
      const next = { ...prev, [key]: value };
      // Save to config row
      const cfg = uatItems.find(i => i.group_name === '__batch_config') || {
        id: `batch_cfg_${project.id}`, project_id: project.id, group_name: '__batch_config',
      };
      debouncedSave({ ...cfg, ...next });
      return next;
    });
  }, [uatItems, project.id, debouncedSave]);

  const handleAddRow = useCallback((groupName) => {
    const newItem = {
      id: `uat_${Date.now()}`,
      project_id: project.id,
      group_name: groupName,
      process_name: '',
      status: 'Not Started',
      uat_approver_id: null,
      ...(isMES && {
        batch_1_status: 'Not Started',
        batch_2_status: 'Not Started',
        batch_3_status: 'Not Started',
        paper_fields: 0, eliminated: 0, automated: 0,
        controlled: 0, remaining: 0, interlocks: 0, compliance_score: 0,
      }),
      ...(!isMES && {
        paper_fields: 0, eliminated: 0, automated: 0,
        controlled: 0, remaining: 0, interlocks: 0, compliance_score: 0,
      }),
    };
    setUatItems(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [project.id, isMES, debouncedSave]);

  const handleDeleteRow = useCallback(async (itemId) => {
    try {
      await deleteUATItem(itemId);
      setUatItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }, []);

  // ── Group rows ───────────────────────────────────────────────────────────────
  const groupedItems = useMemo(() => {
    const result = {};
    groups.forEach(g => {
      result[g] = uatItems.filter(i => i.group_name === g && i.group_name !== '__batch_config');
    });
    return result;
  }, [uatItems, groups]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  if (!isMES && !isLogbooks) return (
    <div className="p-6 text-gray-500 text-sm">
      UAT tracker not configured for this project type. Set <code>uat_type</code> to <code>mes</code> or <code>logbooks</code>.
    </div>
  );

  // ── Column definitions ───────────────────────────────────────────────────────
  // MES: process | status | approver | B1 | B2 | B3 | paper | elim | auto | ctrl | rem | inter | comp
  // LOG: process | status | approver | paper | elim | auto | ctrl | rem | inter | comp

  const thCls = 'px-2 py-1.5 text-center font-semibold text-[10px] text-gray-700 border-r border-gray-300';
  const tdCls = 'px-2 py-1 border-r border-gray-200 text-xs';
  const superTh = 'px-2 py-1 text-center text-xs font-bold border-r border-gray-300 bg-gray-200';

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">{isMES ? 'MES' : 'Logbooks'} UAT Tracker</h3>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="border-collapse text-xs w-full">
          <thead>
            {/* ── Super-header row ── */}
            <tr className="bg-gray-200 border-b border-gray-300">
              <th className={`${superTh} w-8`} />
              <th colSpan={3} className={`${superTh} text-left`}>Configuration</th>
              {isMES && <th colSpan={3} className={superTh}>UAT</th>}
              <th colSpan={7} className={superTh}>Case Study</th>
            </tr>

            {/* ── Column headers ── */}
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className={`${thCls} w-8`} />
              <th className={`${thCls} text-left w-40`}>Process Name</th>
              <th className={`${thCls} w-28`}>Status</th>
              <th className={`${thCls} w-32`}>UAT Approver</th>
              {isMES && <>
                <th className={`${thCls} w-24`}>Batch 1</th>
                <th className={`${thCls} w-24`}>Batch 2</th>
                <th className={`${thCls} w-24`}>Batch 3</th>
              </>}
              <th className={`${thCls} w-20`}>Paper Fields</th>
              <th className={`${thCls} w-20`}>Eliminated</th>
              <th className={`${thCls} w-20`}>Automated</th>
              <th className={`${thCls} w-20`}>Controlled</th>
              <th className={`${thCls} w-20`}>Remaining</th>
              <th className={`${thCls} w-20`}>Interlocks</th>
              <th className="px-2 py-1.5 text-center font-semibold text-[10px] text-gray-700 w-24">Compliance Score</th>
            </tr>

            {/* ── Batch date rows (MES only) ── */}
            {isMES && <>
              <tr className="bg-blue-50 border-b border-gray-200">
                <td className={`${tdCls} text-gray-500 font-medium`} />
                <td className={`${tdCls} font-medium text-gray-600`} colSpan={3}>Start Date</td>
                {[1,2,3].map(n => (
                  <td key={n} className={tdCls}>
                    <input type="date" value={batchDates[`batch_${n}_start`] || ''} disabled={!canEdit}
                      onChange={e => handleBatchDateChange(`batch_${n}_start`, e.target.value)}
                      className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 disabled:bg-transparent" />
                  </td>
                ))}
                <td colSpan={7} />
              </tr>
              <tr className="bg-blue-50 border-b border-gray-300">
                <td className={tdCls} />
                <td className={`${tdCls} font-medium text-gray-600`} colSpan={3}>End Date</td>
                {[1,2,3].map(n => (
                  <td key={n} className={tdCls}>
                    <input type="date" value={batchDates[`batch_${n}_end`] || ''} disabled={!canEdit}
                      onChange={e => handleBatchDateChange(`batch_${n}_end`, e.target.value)}
                      className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 disabled:bg-transparent" />
                  </td>
                ))}
                <td colSpan={7} />
              </tr>
            </>}
          </thead>

          <tbody>
            {groups.map(groupName => (
              <React.Fragment key={groupName}>
                {/* Group header */}
                <tr className="bg-gray-100 border-b border-gray-300">
                  <td colSpan={isMES ? 14 : 11} className="px-3 py-1.5 font-bold text-xs text-gray-800">{groupName}</td>
                </tr>

                {/* Data rows */}
                {groupedItems[groupName]?.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white border-b' : 'bg-gray-50 border-b'}>
                    {/* Three-dots menu */}
                    <td className="px-1 py-1 border-r border-gray-200 w-8">
                      <div className="relative flex items-center justify-center">
                        <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                          className="p-0.5 hover:bg-gray-200 rounded">
                          <MoreVertical size={12} className="text-gray-400" />
                        </button>
                        {openMenuId === item.id && canDelete && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute left-6 top-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-20">
                              <button onClick={() => { setOpenMenuId(null); handleDeleteRow(item.id); }}
                                className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                                <Trash2 size={10} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Process Name */}
                    <td className={tdCls}>
                      <TextCell value={item.process_name} disabled={!canEdit} placeholder="Process name…"
                        onChange={v => handleChange(item.id, 'process_name', v)} />
                    </td>

                    {/* Status */}
                    <td className={tdCls}>
                      {canEdit
                        ? <ColoredSelect value={item.status} options={UAT_STATUS_OPTIONS} colorMap={STATUS_COLORS}
                            onChange={v => handleChange(item.id, 'status', v)} />
                        : <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status || '—'}</span>
                      }
                    </td>

                    {/* UAT Approver */}
                    <td className={tdCls}>
                      {canEdit
                        ? <select value={item.uat_approver_id || ''} onChange={e => handleChange(item.id, 'uat_approver_id', e.target.value)}
                            className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-blue-400">
                            <option value="">—</option>
                            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        : people.find(p => p.id === item.uat_approver_id)?.name || '—'
                      }
                    </td>

                    {/* Batch statuses (MES only) */}
                    {isMES && [1,2,3].map(n => (
                      <td key={n} className={tdCls}>
                        {canEdit
                          ? <ColoredSelect value={item[`batch_${n}_status`]} options={UAT_BATCH_STATUS_OPTIONS}
                              colorMap={BATCH_STATUS_COLORS} onChange={v => handleChange(item.id, `batch_${n}_status`, v)} />
                          : <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BATCH_STATUS_COLORS[item[`batch_${n}_status`]] || ''}`}>{item[`batch_${n}_status`] || '—'}</span>
                        }
                      </td>
                    ))}

                    {/* Numeric fields */}
                    {['paper_fields','eliminated','automated','controlled','remaining','interlocks','compliance_score'].map(f => (
                      <td key={f} className={`${tdCls} text-right`}>
                        <NumCell value={item[f]} disabled={!canEdit} onChange={v => handleChange(item.id, f, v)} />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Add Row */}
                {canEdit && (
                  <tr className="bg-gray-50 border-b">
                    <td colSpan={isMES ? 14 : 11} className="px-3 py-1.5">
                      <button onClick={() => handleAddRow(groupName)}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium">
                        <Plus size={13} /> Add Row
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
