import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MoreVertical, Plus, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayments, upsertPayment, deletePayment, getPlanTasks } from '../../../lib/supabase';
import { PAYMENTS_TEMPLATE, PAYMENT_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../../../lib/templates';
import { formatDate } from '../../../lib/workdays';
import { useAuth } from '../../../contexts/AuthContext';

// ── Dropdown color maps ──────────────────────────────────────────────────────
const PAYMENT_STATUS_COLORS = {
  'Not Paid':        'bg-gray-100 text-gray-700',
  'Invoice Sent':    'bg-blue-100 text-blue-700',
  'Project Pending': 'bg-amber-100 text-amber-700',
  'Paid':            'bg-emerald-100 text-emerald-700',
};

const MILESTONE_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done':        'bg-green-100 text-green-800',
  'Blocked':     'bg-red-100 text-red-800',
};

// Pill badge for read-only mode
const StatusPill = ({ value, colorMap }) => {
  const cls = colorMap[value] || 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{value || '—'}</span>;
};

// Colored select — background matches selected value
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

const PaymentsTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [payments, setPayments] = useState([]);
  const [planTasks, setPlanTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Column widths (resizable)
  const LS_KEY = `payCols_${project?.id}`;
  const DEFAULT_COLS = { actions: 36, line_item: 160, milestone: 140, type: 130, amount: 90, currency: 70, milestone_status: 110, planned_date: 130, invoice_id: 100, payment_status: 120, pending_amount: 110 };
  const [colWidths, setColWidths] = useState(() => {
    try { const s = localStorage.getItem(LS_KEY); return s ? { ...DEFAULT_COLS, ...JSON.parse(s) } : { ...DEFAULT_COLS }; } catch { return { ...DEFAULT_COLS }; }
  });
  const resizingRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(colWidths)); } catch {} }, [colWidths]);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current) return;
      const { key, startX, startW } = resizingRef.current;
      setColWidths(p => ({ ...p, [key]: Math.max(50, startW + (e.clientX - startX)) }));
    };
    const onUp = () => { resizingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const canDeleteRows = isAdmin() || (isDM() && project?.dm_id === user?.id);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [paymentsData, tasksData] = await Promise.all([
          getPayments(project.id),
          getPlanTasks(project.id),
        ]);
        setPayments(paymentsData || []);
        setPlanTasks(tasksData || []);
      } catch (error) {
        toast.error('Failed to load payments data');
      } finally { setLoading(false); }
    };
    if (project?.id) loadData();
  }, [project?.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const h = () => setOpenMenuId(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [openMenuId]);

  const debouncedSave = useCallback(
    (() => {
      let t;
      return (item) => {
        clearTimeout(t);
        t = setTimeout(async () => {
          try { await upsertPayment(project.id, item); }
          catch { toast.error('Failed to save payment item'); }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleCellChange = useCallback(
    (itemId, field, value) => {
      setPayments(prev => {
        const updated = prev.map(item => {
          if (item.id !== itemId) return item;
          let next = { ...item, [field]: value };
          // Auto-set pending_amount to 0 when Invoice Sent
          if (field === 'payment_status' && value === 'Invoice Sent') {
            next.pending_milestone_amount = 0;
          }
          return next;
        });
        const item = updated.find(i => i.id === itemId);
        if (item) debouncedSave(item);
        return updated;
      });
    },
    [debouncedSave]
  );

  const handleAddRow = useCallback(() => {
    const newItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      line_item: '',
      milestone: '',
      type: 'Annual Subscription',
      amount: 0,
      currency: 'USD',
      milestone_status: 'Not Started',
      planned_milestone_completion_date: null,
      invoice_id: '',
      payment_status: 'Not Paid',
      pending_milestone_amount: 0, // set equal to amount (which is 0 by default)
    };
    setPayments(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [project.id, debouncedSave]);

  // When amount changes, mirror to pending_amount if not Invoice Sent
  const handleAmountChange = useCallback(
    (itemId, value) => {
      setPayments(prev => {
        const updated = prev.map(item => {
          if (item.id !== itemId) return item;
          const shouldMirror = item.payment_status !== 'Invoice Sent' && item.payment_status !== 'Paid';
          return { ...item, amount: value, pending_milestone_amount: shouldMirror ? value : item.pending_milestone_amount };
        });
        const item = updated.find(i => i.id === itemId);
        if (item) debouncedSave(item);
        return updated;
      });
    },
    [debouncedSave]
  );

  const handleDeleteRow = useCallback(async (itemId) => {
    try {
      await deletePayment(itemId);
      setPayments(prev => prev.filter(item => item.id !== itemId));
      toast.success('Payment item deleted');
    } catch { toast.error('Failed to delete payment item'); }
  }, []);

  const handleExport = useCallback(() => {
    const headers = ['Line Item','Milestone','Type','Amount','Currency','Milestone Status','Planned Completion','Invoice ID','Payment Status','Pending Amount'];
    const rows = payments.map(i => [i.line_item,i.milestone,i.type,i.amount,i.currency,i.milestone_status,i.planned_milestone_completion_date,i.invoice_id,i.payment_status,i.pending_milestone_amount]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payments_${project.id}.csv`;
    a.click();
    toast.success('Exported');
  }, [payments, project.id]);

  const ResizeHandle = ({ colKey }) => (
    <div
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 z-10"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { key: colKey, startX: e.clientX, startW: colWidths[colKey] }; }}
    />
  );

  const cw = (k) => ({ width: colWidths[k], minWidth: colWidths[k] });

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Payments Tracker</h3>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              <Plus size={16} /> Add Row
            </button>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg select-none">
        <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="bg-gray-100 border-b">
              {/* Three-dots column */}
              <th className="relative border-r" style={cw('actions')} />
              {[
                { key: 'line_item', label: 'Line Item' },
                { key: 'milestone', label: 'Milestone' },
                { key: 'type', label: 'Type' },
                { key: 'amount', label: 'Amount', right: true },
                { key: 'currency', label: 'Currency' },
                { key: 'milestone_status', label: 'Milestone Status' },
                { key: 'planned_date', label: 'Planned Completion' },
                { key: 'invoice_id', label: 'Invoice ID' },
                { key: 'payment_status', label: 'Payment Status' },
                { key: 'pending_amount', label: 'Pending Amount', right: true },
              ].map(({ key, label, right }) => (
                <th key={key} className={`relative px-2 py-2 font-semibold border-r text-gray-700 ${right ? 'text-right' : 'text-left'}`} style={cw(key)}>
                  {label}
                  <ResizeHandle colKey={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white border-b' : 'bg-gray-50 border-b'}>
                {/* Three-dots actions menu */}
                <td className="border-r text-center" style={cw('actions')}>
                  <div className="relative flex items-center justify-center h-full">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <MoreVertical size={13} className="text-gray-400" />
                    </button>
                    {openMenuId === item.id && canDeleteRows && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute left-7 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-24">
                          <button
                            onClick={() => { setOpenMenuId(null); handleDeleteRow(item.id); }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>

                {/* Line Item */}
                <td className="px-2 py-1 border-r" style={cw('line_item')}>
                  {canEdit ? (
                    <input type="text" value={item.line_item || ''} onChange={e => handleCellChange(item.id, 'line_item', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                  ) : item.line_item || '—'}
                </td>

                {/* Milestone */}
                <td className="px-2 py-1 border-r" style={cw('milestone')}>
                  {canEdit ? (
                    <input type="text" value={item.milestone || ''} onChange={e => handleCellChange(item.id, 'milestone', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                  ) : item.milestone || '—'}
                </td>

                {/* Type */}
                <td className="px-2 py-1 border-r" style={cw('type')}>
                  {canEdit ? (
                    <select value={item.type || ''} onChange={e => handleCellChange(item.id, 'type', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 bg-white">
                      <option value="">—</option>
                      {PAYMENT_TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : item.type || '—'}
                </td>

                {/* Amount */}
                <td className="px-2 py-1 border-r text-right" style={cw('amount')}>
                  {canEdit ? (
                    <input type="number" value={item.amount || 0} onChange={e => handleAmountChange(item.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:border-blue-400" />
                  ) : item.amount ?? '—'}
                </td>

                {/* Currency */}
                <td className="px-2 py-1 border-r" style={cw('currency')}>
                  {canEdit ? (
                    <select value={item.currency || ''} onChange={e => handleCellChange(item.id, 'currency', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 bg-white">
                      <option value="">—</option>
                      {CURRENCY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : item.currency || '—'}
                </td>

                {/* Milestone Status */}
                <td className="px-2 py-1 border-r" style={cw('milestone_status')}>
                  {canEdit ? (
                    <ColoredSelect value={item.milestone_status} options={['Not Started','In Progress','Done','Blocked']}
                      colorMap={MILESTONE_STATUS_COLORS} onChange={v => handleCellChange(item.id, 'milestone_status', v)} />
                  ) : <StatusPill value={item.milestone_status} colorMap={MILESTONE_STATUS_COLORS} />}
                </td>

                {/* Planned Completion */}
                <td className="px-2 py-1 border-r" style={cw('planned_date')}>
                  {canEdit ? (
                    <input type="date" value={item.planned_milestone_completion_date || ''} onChange={e => handleCellChange(item.id, 'planned_milestone_completion_date', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                  ) : item.planned_milestone_completion_date ? new Date(item.planned_milestone_completion_date).toLocaleDateString() : '—'}
                </td>

                {/* Invoice ID */}
                <td className="px-2 py-1 border-r" style={cw('invoice_id')}>
                  {canEdit ? (
                    <input type="text" value={item.invoice_id || ''} onChange={e => handleCellChange(item.id, 'invoice_id', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400" />
                  ) : item.invoice_id || '—'}
                </td>

                {/* Payment Status */}
                <td className="px-2 py-1 border-r" style={cw('payment_status')}>
                  {canEdit ? (
                    <ColoredSelect value={item.payment_status} options={PAYMENT_STATUS_OPTIONS}
                      colorMap={PAYMENT_STATUS_COLORS} onChange={v => handleCellChange(item.id, 'payment_status', v)} />
                  ) : <StatusPill value={item.payment_status} colorMap={PAYMENT_STATUS_COLORS} />}
                </td>

                {/* Pending Amount */}
                <td className="px-2 py-1 border-r text-right" style={cw('pending_amount')}>
                  {canEdit ? (
                    <input type="number" value={item.pending_milestone_amount ?? 0} onChange={e => handleCellChange(item.id, 'pending_milestone_amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:border-blue-400" />
                  ) : item.pending_milestone_amount ?? '—'}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                  No payment items yet. {canEdit && 'Click "Add Row" to create one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentsTab;
