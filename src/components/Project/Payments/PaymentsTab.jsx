import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MoreVertical, Plus, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayments, upsertPayment, deletePayment, getPlanTasks } from '../../../lib/supabase';
import { PAYMENTS_TEMPLATE, PAYMENT_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../../../lib/templates';
import { formatDate } from '../../../lib/workdays';
import { useAuth } from '../../../contexts/AuthContext';
import { useSpreadsheet } from '../../../lib/useSpreadsheet';
import { SCell } from '../../shared/SCell';

// ── Color maps ──────────────────────────────────────────────────────────────
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

// Read-only colored pill
const StatusPill = ({ value, colorMap }) => {
  const cls = colorMap[value] || 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{value || '—'}</span>;
};

// Editable column keys for Tab/Enter navigation
const EDIT_COLS = ['line_item','milestone','type','amount','currency','milestone_status','planned_date','invoice_id','payment_status','pending_amount'];

const PaymentsTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const ss = useSpreadsheet();

  // Column widths (resizable)
  const LS_KEY = `payCols_${project?.id}`;
  const DEFAULT_COLS = { actions: 36, line_item: 160, milestone: 140, type: 130, amount: 90, currency: 70, milestone_status: 110, planned_date: 130, invoice_id: 100, payment_status: 120, pending_amount: 110 };
  const [colWidths, setColWidths] = useState(() => {
    try { const s = localStorage.getItem(LS_KEY); return s ? { ...DEFAULT_COLS, ...JSON.parse(s) } : { ...DEFAULT_COLS }; } catch { return { ...DEFAULT_COLS }; }
  });
  const resizingRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(colWidths)); } catch {} }, [colWidths]);

  useEffect(() => {
    const onMove = e => { if (!resizingRef.current) return; const { key, startX, startW } = resizingRef.current; setColWidths(p => ({ ...p, [key]: Math.max(50, startW + (e.clientX - startX)) })); };
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
        const paymentsData = await getPayments(project.id);
        setPayments(paymentsData || []);
      } catch { toast.error('Failed to load payments data'); }
      finally { setLoading(false); }
    };
    if (project?.id) loadData();
  }, [project?.id]);

  useEffect(() => {
    if (!openMenuId) return;
    const h = () => setOpenMenuId(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [openMenuId]);

  const debouncedSave = useCallback(
    (() => {
      const timers = {};
      return (item) => {
        clearTimeout(timers[item.id]);
        timers[item.id] = setTimeout(async () => {
          try { await upsertPayment(item); }
          catch (e) { toast.error('Failed to save payment item: ' + (e?.message || '')); }
        }, 800);
      };
    })(),
    []
  );

  const handleChange = useCallback((itemId, field, value) => {
    setPayments(prev => {
      const updated = prev.map(item => {
        if (item.id !== itemId) return item;
        let next = { ...item, [field]: value };
        // Invoice Sent → zero out pending
        if (field === 'payment_status' && value === 'Invoice Sent') next.pending_milestone_amount = 0;
        // Not Paid / Project Pending → restore pending to amount
        if (field === 'payment_status' && (value === 'Not Paid' || value === 'Project Pending')) {
          next.pending_milestone_amount = parseFloat(next.amount) || 0;
        }
        // Changing amount while not invoiced → mirror to pending
        if (field === 'amount') {
          const shouldMirror = item.payment_status !== 'Invoice Sent' && item.payment_status !== 'Paid';
          if (shouldMirror) next.pending_milestone_amount = parseFloat(value) || 0;
        }
        debouncedSave(next);
        return next;
      });
      return updated;
    });
  }, [debouncedSave]);

  const handleAddRow = useCallback(() => {
    const newItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      line_item: '', milestone: '', type: 'Annual Subscription',
      amount: 0, currency: 'USD', milestone_status: 'Not Started',
      planned_milestone_completion_date: null,
      invoice_id: '', payment_status: 'Not Paid', pending_milestone_amount: 0,
    };
    setPayments(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [project.id, debouncedSave]);

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
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`payments_${project.id}.csv`; a.click();
    toast.success('Exported');
  }, [payments, project.id]);

  const ResizeHandle = ({ colKey }) => (
    <div className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 z-10"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { key: colKey, startX: e.clientX, startW: colWidths[colKey] }; }} />
  );
  const cw = k => ({ width: colWidths[k], minWidth: colWidths[k] });

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-4 p-6" onClick={() => ss.clearAll()}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Payments Tracker</h3>
        <div className="flex gap-2">
          {canEdit && <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"><Plus size={16}/> Add Row</button>}
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"><Download size={16}/> Export</button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg select-none" onClick={e => e.stopPropagation()}>
        <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="relative border-r" style={cw('actions')} />
              {[
                { key:'line_item',      label:'Line Item' },
                { key:'milestone',      label:'Milestone' },
                { key:'type',           label:'Type' },
                { key:'amount',         label:'Amount',         right:true },
                { key:'currency',       label:'Currency' },
                { key:'milestone_status', label:'Milestone Status' },
                { key:'planned_date',   label:'Planned Completion' },
                { key:'invoice_id',     label:'Invoice ID' },
                { key:'payment_status', label:'Payment Status' },
                { key:'pending_amount', label:'Pending Amount',  right:true },
              ].map(({ key, label, right }) => (
                <th key={key} className={`relative px-2 py-2 font-semibold border-r text-gray-700 ${right?'text-right':'text-left'}`} style={cw(key)}>
                  {label}
                  <ResizeHandle colKey={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white border-b' : 'bg-gray-50 border-b'}>
                {/* Three-dots */}
                <td className="border-r text-center" style={cw('actions')}>
                  <div className="relative flex items-center justify-center h-full">
                    <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }} className="p-1 hover:bg-gray-200 rounded transition">
                      <MoreVertical size={13} className="text-gray-400" />
                    </button>
                    {openMenuId === item.id && canDeleteRows && (
                      <><div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute left-7 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-24">
                          <button onClick={() => { setOpenMenuId(null); handleDeleteRow(item.id); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"><Trash2 size={11}/> Delete</button>
                        </div></>
                    )}
                  </div>
                </td>

                <SCell ss={ss} rowId={item.id} colKey="line_item"        value={item.line_item}   onChange={v => handleChange(item.id,'line_item',v)}   rows={payments} cols={EDIT_COLS} disabled={!canEdit} tdStyle={cw('line_item')} />
                <SCell ss={ss} rowId={item.id} colKey="milestone"        value={item.milestone}   onChange={v => handleChange(item.id,'milestone',v)}   rows={payments} cols={EDIT_COLS} disabled={!canEdit} tdStyle={cw('milestone')} />

                {/* Type — select */}
                <SCell ss={ss} rowId={item.id} colKey="type" value={item.type} onChange={v => handleChange(item.id,'type',v)} rows={payments} cols={EDIT_COLS} type="select" options={PAYMENT_TYPE_OPTIONS} disabled={!canEdit} tdStyle={cw('type')} />

                {/* Amount */}
                <SCell ss={ss} rowId={item.id} colKey="amount" value={String(item.amount ?? 0)} onChange={v => handleChange(item.id,'amount',v)} rows={payments} cols={EDIT_COLS} type="number" disabled={!canEdit} tdStyle={cw('amount')}
                  readView={<span className="ml-auto">{item.amount ?? '—'}</span>} tdClass="text-right" />

                {/* Currency */}
                <SCell ss={ss} rowId={item.id} colKey="currency" value={item.currency} onChange={v => handleChange(item.id,'currency',v)} rows={payments} cols={EDIT_COLS} type="select" options={CURRENCY_OPTIONS} disabled={!canEdit} tdStyle={cw('currency')} />

                {/* Milestone Status */}
                <SCell ss={ss} rowId={item.id} colKey="milestone_status" value={item.milestone_status} onChange={v => handleChange(item.id,'milestone_status',v)} rows={payments} cols={EDIT_COLS} type="colored-select" options={['Not Started','In Progress','Done','Blocked']} colorMap={MILESTONE_STATUS_COLORS} disabled={!canEdit} tdStyle={cw('milestone_status')}
                  readView={<StatusPill value={item.milestone_status} colorMap={MILESTONE_STATUS_COLORS} />} />

                {/* Planned Date */}
                <SCell ss={ss} rowId={item.id} colKey="planned_date" value={item.planned_milestone_completion_date || ''} onChange={v => handleChange(item.id,'planned_milestone_completion_date',v)} rows={payments} cols={EDIT_COLS} type="date" disabled={!canEdit} tdStyle={cw('planned_date')}
                  readView={<span>{item.planned_milestone_completion_date ? new Date(item.planned_milestone_completion_date).toLocaleDateString() : '—'}</span>} />

                {/* Invoice ID */}
                <SCell ss={ss} rowId={item.id} colKey="invoice_id" value={item.invoice_id} onChange={v => handleChange(item.id,'invoice_id',v)} rows={payments} cols={EDIT_COLS} disabled={!canEdit} tdStyle={cw('invoice_id')} />

                {/* Payment Status */}
                <SCell ss={ss} rowId={item.id} colKey="payment_status" value={item.payment_status} onChange={v => handleChange(item.id,'payment_status',v)} rows={payments} cols={EDIT_COLS} type="colored-select" options={PAYMENT_STATUS_OPTIONS} colorMap={PAYMENT_STATUS_COLORS} disabled={!canEdit} tdStyle={cw('payment_status')}
                  readView={<StatusPill value={item.payment_status} colorMap={PAYMENT_STATUS_COLORS} />} />

                {/* Pending Amount */}
                <SCell ss={ss} rowId={item.id} colKey="pending_amount" value={String(item.pending_milestone_amount ?? 0)} onChange={v => handleChange(item.id,'pending_milestone_amount',v)} rows={payments} cols={EDIT_COLS} type="number" disabled={!canEdit} tdStyle={cw('pending_amount')}
                  readView={<span className="ml-auto">{item.pending_milestone_amount ?? '—'}</span>} tdClass="text-right" />
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">No payment items yet. {canEdit && 'Click "Add Row" to create one.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentsTab;
