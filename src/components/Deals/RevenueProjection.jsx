import { useState, useEffect } from 'react';
import { Download, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAllPayments } from '../../lib/supabase';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

export default function RevenueProjection() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const pays = await getAllPayments();
      setPayments(pays);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }

  // Build month list from all planned_milestone_completion_dates
  const monthKeys = [...new Set(
    payments
      .map(p => getMonthKey(p.planned_milestone_completion_date))
      .filter(Boolean)
  )].sort();

  // For each month: Projected Revenue = all payments in that month; Pending Revenue = where status not Invoice Sent/Paid
  const monthData = monthKeys.map(mk => {
    const inMonth = payments.filter(p => getMonthKey(p.planned_milestone_completion_date) === mk);
    const projected = inMonth.reduce((sum, p) => sum + (Number(p.pending_milestone_amount) || Number(p.amount) || 0), 0);
    const pending = inMonth
      .filter(p => !['Invoice Sent', 'Paid'].includes(p.payment_status))
      .reduce((sum, p) => sum + (Number(p.pending_milestone_amount) || Number(p.amount) || 0), 0);
    const invoiceSent = inMonth
      .filter(p => p.payment_status === 'Invoice Sent')
      .reduce((sum, p) => sum + (Number(p.pending_milestone_amount) || Number(p.amount) || 0), 0);
    const paid = inMonth
      .filter(p => p.payment_status === 'Paid')
      .reduce((sum, p) => sum + (Number(p.pending_milestone_amount) || Number(p.amount) || 0), 0);
    return { mk, projected, pending, invoiceSent, paid, rows: inMonth };
  });

  const totalProjected = monthData.reduce((s, m) => s + m.projected, 0);
  const totalPending = monthData.reduce((s, m) => s + m.pending, 0);
  const totalInvoiced = monthData.reduce((s, m) => s + m.invoiceSent, 0);
  const totalPaid = monthData.reduce((s, m) => s + m.paid, 0);

  function fmt(n) { return n ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'; }

  function copyToClipboard() {
    const header = ['Month', 'Projected Revenue ($)', 'Pending Revenue ($)', 'Invoice Sent ($)', 'Paid ($)'].join('\t');
    const rows = monthData.map(m => [monthLabel(m.mk), m.projected, m.pending, m.invoiceSent, m.paid].join('\t'));
    rows.push(['Total', totalProjected, totalPending, totalInvoiced, totalPaid].join('\t'));
    navigator.clipboard.writeText([header, ...rows].join('\n')).then(() => toast.success('Copied to clipboard'));
  }

  function exportCSV() {
    const rows = [
      ['Month', 'Projected Revenue ($)', 'Pending Revenue ($)', 'Invoice Sent ($)', 'Paid ($)'],
      ...monthData.map(m => [monthLabel(m.mk), m.projected, m.pending, m.invoiceSent, m.paid]),
      ['Total', totalProjected, totalPending, totalInvoiced, totalPaid],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'revenue_projection.csv'; a.click();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Revenue Projection</h1>
          <p className="text-xs text-gray-500 mt-0.5">Auto-calculated from pending revenue by planned milestone month.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Projected', value: totalProjected, color: 'blue' },
          { label: 'Total Pending', value: totalPending, color: 'yellow' },
          { label: 'Invoice Sent', value: totalInvoiced, color: 'purple' },
          { label: 'Total Paid', value: totalPaid, color: 'green' },
        ].map(card => (
          <div key={card.label} className={`bg-white border border-gray-200 rounded-xl p-4`}>
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold text-${card.color}-600`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Monthly Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Month</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Projected Revenue</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Pending Revenue</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Invoice Sent</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Paid</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 w-48">Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {monthData.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No revenue data found.</td></tr>
              )}
              {monthData.map((m, i) => (
                <tr key={m.mk} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{monthLabel(m.mk)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{fmt(m.projected)}</td>
                  <td className="px-4 py-2.5 text-right text-yellow-700">{fmt(m.pending)}</td>
                  <td className="px-4 py-2.5 text-right text-purple-700">{fmt(m.invoiceSent)}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{fmt(m.paid)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 w-40">
                      {m.projected > 0 && <>
                        <div style={{ width: `${(m.paid / m.projected) * 100}%` }} className="bg-green-400" />
                        <div style={{ width: `${(m.invoiceSent / m.projected) * 100}%` }} className="bg-purple-400" />
                        <div style={{ width: `${(m.pending / m.projected) * 100}%` }} className="bg-yellow-300" />
                      </>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{m.rows.length} milestone{m.rows.length !== 1 ? 's' : ''}</p>
                  </td>
                </tr>
              ))}
            </tbody>
            {monthData.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td className="px-4 py-2.5 text-gray-800">Total</td>
                  <td className="px-4 py-2.5 text-right text-blue-700">{fmt(totalProjected)}</td>
                  <td className="px-4 py-2.5 text-right text-yellow-700">{fmt(totalPending)}</td>
                  <td className="px-4 py-2.5 text-right text-purple-700">{fmt(totalInvoiced)}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{fmt(totalPaid)}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 inline-block" /> Projected = all amounts in that month</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" /> Pending = not yet Invoice Sent or Paid</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-100 border border-purple-300 inline-block" /> Invoice Sent</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" /> Paid</span>
      </div>
    </div>
  );
}
