import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Plus, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayments, upsertPayment, deletePayment, getPlanTasks } from '../../../lib/supabase';
import { PAYMENTS_TEMPLATE, PAYMENT_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../../../lib/templates';
import { formatDate } from '../../../lib/workdays';
import { useAuth } from '../../../contexts/AuthContext';

const MILESTONE_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done': 'bg-green-100 text-green-800',
  'Blocked': 'bg-red-100 text-red-800',
};

const PAYMENT_STATUS_COLORS = {
  'Not Paid': 'bg-gray-100 text-gray-800',
  'Invoice Sent': 'bg-blue-100 text-blue-800',
  'Project Pending': 'bg-yellow-100 text-yellow-800',
  'Paid': 'bg-green-100 text-green-800',
};

const PaymentsTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [payments, setPayments] = useState([]);
  const [planTasks, setPlanTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});

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
        console.error('Error loading payments data:', error);
        toast.error('Failed to load payments data');
      } finally {
        setLoading(false);
      }
    };

    if (project?.id) {
      loadData();
    }
  }, [project?.id]);

  const debouncedSave = useCallback(
    (() => {
      let timeoutId;
      return (item) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            await upsertPayment(project.id, item);
            toast.success('Payment item saved');
          } catch (error) {
            console.error('Error saving payment item:', error);
            toast.error('Failed to save payment item');
          }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleCellChange = useCallback(
    (itemId, field, value) => {
      setPayments(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );

      const item = payments.find(i => i.id === itemId);
      if (item) {
        debouncedSave({ ...item, [field]: value });
      }
    },
    [payments, debouncedSave]
  );

  const handleAddRow = useCallback(() => {
    const newItem = {
      id: `payment_${Date.now()}`,
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
      pending_milestone_amount: 0,
    };

    setPayments(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [project.id, debouncedSave]);

  const handleDeleteRow = useCallback(
    async (itemId) => {
      try {
        await deletePayment(itemId);
        setPayments(prev => prev.filter(item => item.id !== itemId));
        toast.success('Payment item deleted');
      } catch (error) {
        console.error('Error deleting payment item:', error);
        toast.error('Failed to delete payment item');
      }
    },
    []
  );

  const handleExportToExcel = useCallback(() => {
    try {
      // Prepare CSV data
      const headers = [
        'Line Item',
        'Milestone',
        'Type',
        'Amount',
        'Currency',
        'Milestone Status',
        'Planned Milestone Completion Date',
        'Invoice ID',
        'Payment Status',
        'Pending Milestone Amount',
      ];

      const rows = payments.map(item => [
        item.line_item || '',
        item.milestone || '',
        item.type || '',
        item.amount || '',
        item.currency || '',
        item.milestone_status || '',
        item.planned_milestone_completion_date || '',
        item.invoice_id || '',
        item.payment_status || '',
        item.pending_milestone_amount || '',
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `payments_${project.id}_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Exported to Excel');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  }, [payments, project.id]);

  const sortedItems = useMemo(() => {
    let sorted = [...payments];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        sorted = sorted.filter(item => {
          const itemValue = String(item[key]).toLowerCase();
          return itemValue.includes(String(value).toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [payments, sortConfig, filters]);

  const handleSort = (key) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderStatusPill = (status, colorMap) => {
    const colors = colorMap[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded text-sm font-medium ${colors}`}>
        {status}
      </span>
    );
  };

  const getAutoPlannedDate = (milestoneName) => {
    if (!milestoneName) return null;
    const matchingTask = planTasks.find(
      task => task.activity_name?.toLowerCase() === milestoneName.toLowerCase()
    );
    return matchingTask?.planned_end || null;
  };

  const renderCell = (item, field, itemId) => {
    const value = item[field];
    const isDateField = field === 'planned_milestone_completion_date';
    const isTypeField = field === 'type';
    const isCurrencyField = field === 'currency';
    const isMilestoneStatusField = field === 'milestone_status';
    const isPaymentStatusField = field === 'payment_status';
    const isNumberField = ['amount', 'pending_milestone_amount'].includes(field);

    if (!canEdit) {
      if (isMilestoneStatusField) {
        return renderStatusPill(value, MILESTONE_STATUS_COLORS);
      }
      if (isPaymentStatusField) {
        return renderStatusPill(value, PAYMENT_STATUS_COLORS);
      }
      if (isDateField) {
        // Try to get auto-populated date if not manually set
        const displayDate = value || getAutoPlannedDate(item.milestone);
        return displayDate ? new Date(displayDate).toLocaleDateString() : '-';
      }
      return value || '-';
    }

    if (isTypeField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select type</option>
          {PAYMENT_TYPE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isCurrencyField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select currency</option>
          {CURRENCY_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isMilestoneStatusField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select status</option>
          {['Not Started', 'In Progress', 'Done', 'Blocked'].map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isPaymentStatusField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select status</option>
          {PAYMENT_STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isDateField) {
      const autoDate = getAutoPlannedDate(item.milestone);
      return (
        <div className="relative">
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleCellChange(itemId, field, e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
          {autoDate && !value && (
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
              Auto
            </span>
          )}
        </div>
      );
    }

    if (isNumberField) {
      return (
        <input
          type="number"
          value={value || 0}
          onChange={(e) => handleCellChange(itemId, field, parseFloat(e.target.value) || 0)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => handleCellChange(itemId, field, e.target.value)}
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Payments Tracker</h3>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus size={18} /> Add Row
            </button>
          )}
          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-2 text-left font-semibold border-r w-44">Line Item</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-40">Milestone</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-36">Type</th>
              <th className="px-4 py-2 text-right font-semibold border-r w-28">Amount</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-24">Currency</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-32">Milestone Status</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-48">Planned Completion</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-28">Invoice ID</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-32">Payment Status</th>
              <th className="px-4 py-2 text-right font-semibold border-r w-40">Pending Amount</th>
              <th className="px-4 py-2 text-center font-semibold w-12">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, idx) => (
              <tr
                key={item.id}
                className={idx % 2 === 0 ? 'bg-white border-b' : 'bg-gray-50 border-b'}
              >
                <td className="px-4 py-2 border-r">{renderCell(item, 'line_item', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'milestone', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'type', item.id)}</td>
                <td className="px-4 py-2 border-r text-right">{renderCell(item, 'amount', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'currency', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'milestone_status', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'planned_milestone_completion_date', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'invoice_id', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'payment_status', item.id)}</td>
                <td className="px-4 py-2 border-r text-right">{renderCell(item, 'pending_milestone_amount', item.id)}</td>
                <td className="px-4 py-2 text-center">
                  {canDeleteRows && (
                    <button
                      onClick={() => handleDeleteRow(item.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete row"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
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
