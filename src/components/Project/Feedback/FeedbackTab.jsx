import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Plus, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { getFeedbackItems, upsertFeedbackItem, deleteFeedbackItem } from '../../../lib/supabase';
import { FEEDBACK_TEMPLATE, FEEDBACK_PRIORITY_OPTIONS, FEEDBACK_DEV_STATUS_OPTIONS } from '../../../lib/templates';
import { useAuth } from '../../../contexts/AuthContext';
import { useSpreadsheet } from '../../../lib/useSpreadsheet';
import { SCell } from '../../shared/SCell';

const PRIORITY_COLORS = {
  'Critical': 'bg-red-100 text-red-800',
  'High':     'bg-orange-100 text-orange-800',
  'Medium':   'bg-yellow-100 text-yellow-800',
  'Low':      'bg-blue-100 text-blue-800',
};

const DEV_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done':        'bg-green-100 text-green-800',
  'On Hold':     'bg-purple-100 text-purple-800',
  'Cancelled':   'bg-red-100 text-red-800',
};

const EDIT_COLS = ['requirement', 'delivery_priority', 'clickup_task_id', 'dev_status', 'due_date_committed'];

const isValidUrl = (string) => {
  try { new URL(string); return true; } catch { return false; }
};

const FeedbackTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters]   = useState({});
  const ss = useSpreadsheet();

  const canDeleteRows = isAdmin() || isDM();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const items = await getFeedbackItems(project.id);
        setFeedbackItems(items || []);
      } catch (error) {
        console.error('Error loading feedback data:', error);
        toast.error('Failed to load feedback data');
      } finally {
        setLoading(false);
      }
    };
    if (project?.id) loadData();
  }, [project?.id]);

  const debouncedSave = useCallback(
    (() => {
      const timers = {};
      return (item) => {
        clearTimeout(timers[item.id]);
        timers[item.id] = setTimeout(async () => {
          try { await upsertFeedbackItem(project.id, item); }
          catch (error) {
            console.error('Error saving feedback item:', error);
            toast.error('Failed to save feedback item');
          }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleCellChange = useCallback((itemId, field, value) => {
    setFeedbackItems(prevItems => {
      const next = prevItems.map(item => item.id === itemId ? { ...item, [field]: value } : item);
      const item = next.find(i => i.id === itemId);
      if (item) debouncedSave(item);
      return next;
    });
  }, [debouncedSave]);

  const handleAddRow = useCallback(() => {
    const maxNumber = Math.max(0, ...feedbackItems.map(item => item.number || 0));
    const newItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      number: maxNumber + 1,
      requirement: '',
      delivery_priority: 'Medium',
      clickup_task_id: '',
      dev_status: 'Not Started',
      due_date_committed: null,
    };
    setFeedbackItems(prev => [...prev, newItem]);
    debouncedSave(newItem);
  }, [feedbackItems, project.id, debouncedSave]);

  const handleDeleteRow = useCallback(async (itemId) => {
    try {
      await deleteFeedbackItem(itemId);
      setFeedbackItems(prev => prev.filter(item => item.id !== itemId));
      toast.success('Feedback item deleted');
    } catch (error) {
      console.error('Error deleting feedback item:', error);
      toast.error('Failed to delete feedback item');
    }
  }, []);

  const sortedItems = useMemo(() => {
    let sorted = [...feedbackItems];
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        sorted = sorted.filter(item => String(item[key]).toLowerCase().includes(String(value).toLowerCase()));
      }
    });
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
  }, [feedbackItems, sortConfig, filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6" onClick={() => ss.clearAll()}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Feedback &amp; Requirements</h3>
        {canEdit && (
          <button
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={18} /> Add Row
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg select-none" onClick={e => e.stopPropagation()}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-2 text-center font-semibold border-r w-12">#</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-80">Requirement</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-36">Delivery Priority</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-40">Clickup Task ID</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-44">Development Status</th>
              <th className="px-4 py-2 text-left font-semibold border-r w-44">Due Date Committed</th>
              <th className="px-4 py-2 text-center font-semibold w-12">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, idx) => (
              <tr
                key={item.id}
                className={idx % 2 === 0 ? 'bg-white border-b' : 'bg-gray-50 border-b'}
              >
                {/* Row number — not editable */}
                <td className="px-4 py-2 text-center border-r font-medium text-xs">{item.number}</td>

                {/* Requirement */}
                <SCell ss={ss} rowId={item.id} colKey="requirement"
                  value={item.requirement || ''}
                  onChange={v => handleCellChange(item.id, 'requirement', v)}
                  rows={sortedItems} cols={EDIT_COLS}
                  placeholder="Enter requirement…"
                  disabled={!canEdit} />

                {/* Priority */}
                <SCell ss={ss} rowId={item.id} colKey="delivery_priority"
                  value={item.delivery_priority || ''}
                  onChange={v => handleCellChange(item.id, 'delivery_priority', v)}
                  rows={sortedItems} cols={EDIT_COLS}
                  type="colored-select"
                  options={FEEDBACK_PRIORITY_OPTIONS}
                  colorMap={PRIORITY_COLORS}
                  disabled={!canEdit}
                  readView={
                    item.delivery_priority
                      ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[item.delivery_priority] || 'bg-gray-100 text-gray-800'}`}>{item.delivery_priority}</span>
                      : <span className="text-gray-400 text-xs">—</span>
                  } />

                {/* Clickup Task ID */}
                <SCell ss={ss} rowId={item.id} colKey="clickup_task_id"
                  value={item.clickup_task_id || ''}
                  onChange={v => handleCellChange(item.id, 'clickup_task_id', v)}
                  rows={sortedItems} cols={EDIT_COLS}
                  placeholder="Paste URL or task ID"
                  disabled={!canEdit}
                  readView={
                    item.clickup_task_id
                      ? isValidUrl(item.clickup_task_id)
                        ? <a href={item.clickup_task_id} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs">
                            {item.clickup_task_id} <ExternalLink size={11} />
                          </a>
                        : <span className="text-xs">{item.clickup_task_id}</span>
                      : <span className="text-gray-400 text-xs">—</span>
                  } />

                {/* Dev Status */}
                <SCell ss={ss} rowId={item.id} colKey="dev_status"
                  value={item.dev_status || ''}
                  onChange={v => handleCellChange(item.id, 'dev_status', v)}
                  rows={sortedItems} cols={EDIT_COLS}
                  type="colored-select"
                  options={FEEDBACK_DEV_STATUS_OPTIONS}
                  colorMap={DEV_STATUS_COLORS}
                  disabled={!canEdit}
                  readView={
                    item.dev_status
                      ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${DEV_STATUS_COLORS[item.dev_status] || 'bg-gray-100 text-gray-800'}`}>{item.dev_status}</span>
                      : <span className="text-gray-400 text-xs">—</span>
                  } />

                {/* Due Date */}
                <SCell ss={ss} rowId={item.id} colKey="due_date_committed"
                  value={item.due_date_committed || ''}
                  onChange={v => handleCellChange(item.id, 'due_date_committed', v)}
                  rows={sortedItems} cols={EDIT_COLS}
                  type="date"
                  disabled={!canEdit}
                  readView={
                    item.due_date_committed
                      ? <span className="text-xs">{new Date(item.due_date_committed).toLocaleDateString()}</span>
                      : <span className="text-gray-400 text-xs">—</span>
                  } />

                {/* Actions */}
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
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500 text-sm">
                  No feedback items yet. {canEdit && 'Click "Add Row" to create one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeedbackTab;
