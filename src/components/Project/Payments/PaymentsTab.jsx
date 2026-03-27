import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MoreVertical, Plus, Download, Trash2, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayments, upsertPayment, deletePayment } from '../../../lib/supabase';
import { PAYMENT_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../../../lib/templates';
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

// All editable columns (canonical definition)
const ALL_COLS = [
  { key: 'line_item',        label: 'Line Item',           defaultW: 160 },
  { key: 'milestone',        label: 'Milestone',            defaultW: 140 },
  { key: 'type',             label: 'Type',                 defaultW: 130 },
  { key: 'amount',           label: 'Amount',               defaultW: 90,  right: true },
  { key: 'currency',         label: 'Currency',             defaultW: 70 },
  { key: 'milestone_status', label: 'Milestone Status',     defaultW: 110 },
  { key: 'planned_date',     label: 'Planned Completion',   defaultW: 130 },
  { key: 'invoice_id',       label: 'Invoice ID',           defaultW: 100 },
  { key: 'payment_status',   label: 'Payment Status',       defaultW: 120 },
  { key: 'pending_amount',   label: 'Pending Amount',       defaultW: 110, right: true },
];
const ALL_COL_KEYS = ALL_COLS.map(c => c.key);

const PaymentsTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const ss = useSpreadsheet();

  // ── Column widths (resizable) ──────────────────────────────────────────────
  const LS_WIDTHS_KEY = `payCols_${project?.id}`;
  const DEFAULT_WIDTHS = Object.fromEntries(ALL_COLS.map(c => [c.key, c.defaultW]));
  const [colWidths, setColWidths] = useState(() => {
    try { const s = localStorage.getItem(LS_WIDTHS_KEY); return s ? { ...DEFAULT_WIDTHS, ...JSON.parse(s) } : { ...DEFAULT_WIDTHS }; } catch { return { ...DEFAULT_WIDTHS }; }
  });
  const resizingRef = useRef(null);
  useEffect(() => { try { localStorage.setItem(LS_WIDTHS_KEY, JSON.stringify(colWidths)); } catch {} }, [colWidths]);

  useEffect(() => {
    const onMove = e => { if (!resizingRef.current) return; const { key, startX, startW } = resizingRef.current; setColWidths(p => ({ ...p, [key]: Math.max(50, startW + (e.clientX - startX)) })); };
    const onUp = () => { resizingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Column order (draggable) ───────────────────────────────────────────────
  const LS_ORDER_KEY = `payColOrder_${project?.id}`;
  const [colOrder, setColOrder] = useState(() => {
    try { const s = localStorage.getItem(LS_ORDER_KEY); if (s) { const parsed = JSON.parse(s); if (Array.isArray(parsed) && parsed.length === ALL_COL_KEYS.length) return parsed; } } catch {}
    return [...ALL_COL_KEYS];
  });
  useEffect(() => { try { localStorage.setItem(LS_ORDER_KEY, JSON.stringify(colOrder)); } catch {} }, [colOrder]);

  const dragColRef = useRef(null);
  const [dragColOver, setDragColOver] = useState(null);

  const handleColDragStart = (key) => { dragColRef.current = key; };
  const handleColDragOver = (e, key) => { e.preventDefault(); setDragColOver(key); };
  const handleColDrop = (targetKey) => {
    const from = dragColRef.current;
    if (!from || from === targetKey) { dragColRef.current = null; setDragColOver(null); return; }
    setColOrder(prev => {
      const arr = [...prev];
      const fi = arr.indexOf(from), ti = arr.indexOf(targetKey);
      arr.splice(fi, 1); arr.splice(ti, 0, from);
      return arr;
    });
    dragColRef.current = null;
    setDragColOver(null);
  };

  // ── Row drag-and-drop ──────────────────────────────────────────────────────
  const [dragRowIdx, setDragRowIdx] = useState(null);
  const [dragRowOver, setDragRowOver] = useState(null);
  const dragRowNodeRef = useRef(null);

  const handleRowDragStart = useCallback((e, idx) => {
    dragRowNodeRef.current = idx;
    setDragRowIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleRowDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragRowOver(idx);
  }, []);

  const handleRowDrop = useCallback(async (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragRowNodeRef.current;
    setDragRowIdx(null);
    setDragRowOver(null);
    dragRowNodeRef.current = null;
    if (fromIdx === null || fromIdx === dropIdx) return;
    setPayments(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(dropIdx, 0, moved);
      const withOrder = arr.map((p, i) => ({ ...p, sort_order: i }));
      // Persist sort_order updates
      withOrder.forEach(p => { upsertPayment(p).catch(() => {}); });
      return withOrder;
    });
  }, []);

  const handleRowDragEnd = useCallback(() => {
    setDragRowIdx(null);
    setDragRowOver(null);
    dragRowNodeRef.current = null;
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const canDeleteRows = isAdmin() || (isDM() && project?.dm_id === user?.id);

  // ── Load ───────────────────────────────────────────────────────────────────
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

  // ── Save (debounced per-row) ───────────────────────────────────────────────
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
        if (field === 'payment_status' && value === 'Invoice Sent') next.pending_milestone_amount = 0;
        if (field === 'payment_status' && (value === 'Not Paid' || value === 'Project Pending')) {
          next.pending_milestone_amount = parseFloat(next.amount) || 0;
        }
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
      sort_order: payments.length,
    };
    setPayments(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [project.id, debouncedSave, payments.length]);

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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const ResizeHandle = ({ colKey }) => (
    <div className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-60 z-10"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); resizingRef.current = { key: colKey, startX: e.clientX, startW: colWidths[colKey] }; }} />
  );
  const cw = k => ({ width: colWidths[k], minWidth: colWidths[k] });

  // Ordered column definitions
  const orderedCols = colOrder.map(k => ALL_COLS.find(c => c.key === k)).filter(Boolean);
  const EDIT_COLS = colOrder;

  // Render a cell by column key
  const renderCell = (item, colKey) => {
    switch (colKey) {
      case 'line_item':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="line_item" value={item.line_item} onChange={v => handleChange(item.id,'line_item',v)} rows={payments} cols={EDIT_COLS} disabled={!canEdit} tdStyle={cw('line_item')} />;
      case 'milestone':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="milestone" value={item.milestone} onChange={v => handleChange(item.id,'milestone',v)} rows={payments} cols={EDIT_COLS} disabled={!canEdit} tdStyle={cw('milestone')} />;
      case 'type':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="type" value={item.type} onChange={v => handleChange(item.id,'type',v)} rows={payments} cols={EDIT_COLS} type="select" options={PAYMENT_TYPE_OPTIONS} disabled={!canEdit} tdStyle={cw('type')} />;
      case 'amount':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="amount" value={String(item.amount ?? 0)} onChange={v => handleChange(item.id,'amount',v)} rows={payments} cols={EDIT_COLS} type="number" disabled={!canEdit} tdStyle={cw('amount')} readView={<span className="ml-auto">{item.amount ?? '—'}</span>} tdClass="text-right" />;
      case 'currency':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="currency" value={item.currency} onChange={v => handleChange(item.id,'currency',v)} rows={payments} cols={EDIT_COLS} type="select" options={CURRENCY_OPTIONS} disabled={!canEdit} tdStyle={cw('currency')} />;
      case 'milestone_status':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="milestone_status" value={item.milestone_status} onChange={v => handleChange(item.id,'milestone_status',v)} rows={payments} cols={EDIT_COLS} type="colored-select" options={['Not Started','In Progress','Done','Blocked']} colorMap={MILESTONE_STATUS_COLORS} disabled={!canEdit} tdStyle={cw('milestone_status')} readView={<StatusPill value={item.milestone_status} colorMap={MILESTONE_STATUS_COLORS} />} />;
      case 'planned_date':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="planned_date" value={item.planned_milestone_completion_date || ''} onChange={v => handleChange(item.id,'planned_milestone_completion_date',v)} rows={payments} cols={EDIT_COLS} type="date" disabled={!canEdit} tdStyle={cw('planned_date')} readView={<span>{item.planned_milestone_completion_date ? new Date(item.planned_milestone_completion_date).toLocaleDateString() : '—'}</span>} />;
      case 'invoice_id':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="invoice_id" value={item.invoice_id} onChange={v => handleChange(item.id,'invoice_id',v)} rows={payments} cols={EDIT_COLS} disabled={!canEdit} tdStyle={cw('invoice_id')} />;
      case 'payment_status':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="payment_status" value={item.payment_status} onChange={v => handleChange(item.id,'payment_status',v)} rows={payments} cols={EDIT_COLS} type="colored-select" options={PAYMENT_STATUS_OPTIONS} colorMap={PAYMENT_STATUS_COLORS} disabled={!canEdit} tdStyle={cw('payment_status')} readView={<StatusPill value={item.payment_status} colorMap={PAYMENT_STATUS_COLORS} />} />;
      case 'pending_amount':
        return <SCell key={colKey} ss={ss} rowId={item.id} colKey="pending_amount" value={String(item.pending_milestone_amount ?? 0)} onChange={v => handleChange(item.id,'pending_milestone_amount',v)} rows={payments} cols={EDIT_COLS} type="number" disabled={!canEdit} tdStyle={cw('pending_amount')} readView={<span className="ml-auto">{item.pending_milestone_amount ?? '—'}</span>} tdClass="text-right" />;
      default:
        return <td key={colKey} />;
    }
  };

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
              {/* Drag handle header */}
              <th className="relative border-r" style={{ width: 28, minWidth: 28 }} />
              {/* Actions header */}
              <th className="relative border-r" style={{ width: 36, minWidth: 36 }} />
              {orderedCols.map(({ key, label, right }) => (
                <th
                  key={key}
                  className={`relative px-2 py-2 font-semibold border-r text-gray-700 cursor-grab select-none ${right ? 'text-right' : 'text-left'} ${dragColOver === key ? 'bg-blue-100' : ''}`}
                  style={{ ...cw(key), userSelect: 'none' }}
                  draggable
                  onDragStart={() => handleColDragStart(key)}
                  onDragOver={e => handleColDragOver(e, key)}
                  onDrop={() => handleColDrop(key)}
                  onDragEnd={() => setDragColOver(null)}
                >
                  {label}
                  <ResizeHandle colKey={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b transition-opacity ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${dragRowIdx === idx ? 'opacity-40' : ''} ${dragRowOver === idx ? 'border-t-2 border-blue-400' : ''}`}
                draggable={canEdit}
                onDragStart={canEdit ? e => handleRowDragStart(e, idx) : undefined}
                onDragOver={canEdit ? e => handleRowDragOver(e, idx) : undefined}
                onDrop={canEdit ? e => handleRowDrop(e, idx) : undefined}
                onDragEnd={canEdit ? handleRowDragEnd : undefined}
              >
                {/* Row drag handle */}
                <td className="border-r text-center" style={{ width: 28, minWidth: 28 }}>
                  {canEdit && (
                    <span className="cursor-grab text-gray-300 hover:text-gray-500 flex items-center justify-center h-full py-1">
                      <GripVertical size={14} />
                    </span>
                  )}
                </td>

                {/* Three-dots menu */}
                <td className="border-r text-center" style={{ width: 36, minWidth: 36 }}>
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

                {orderedCols.map(({ key }) => renderCell(item, key))}
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={orderedCols.length + 2} className="px-4 py-8 text-center text-sm text-gray-500">No payment items yet. {canEdit && 'Click "Add Row" to create one.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <p className="text-xs text-gray-400 mt-1">
          Drag the <GripVertical size={11} className="inline" /> handle to reorder rows · Drag column headers to reorder columns
        </p>
      )}
    </div>
  );
};

export default PaymentsTab;
