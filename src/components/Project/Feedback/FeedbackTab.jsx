import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Plus, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { getFeedbackItems, upsertFeedbackItem, deleteFeedbackItem } from '../../../lib/supabase';
import { FEEDBACK_TEMPLATE, FEEDBACK_PRIORITY_OPTIONS, FEEDBACK_DEV_STATUS_OPTIONS } from '../../../lib/templates';
import { useAuth } from '../../../contexts/AuthContext';

const PRIORITY_COLORS = {
  'Critical': 'bg-red-100 text-red-800',
  'High': 'bg-orange-100 text-orange-800',
  'Medium': 'bg-yellow-100 text-yellow-800',
  'Low': 'bg-blue-100 text-blue-800',
};

const DEV_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done': 'bg-green-100 text-green-800',
  'On Hold': 'bg-purple-100 text-purple-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const extractClickupTaskId = (input) => {
  // Try to extract task ID from clickup URL
  const urlMatch = input.match(/clickup\.com\/t\/([A-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // If it looks like a task ID already, return it
  if (/^[A-Z0-9]+$/.test(input)) return input;

  return null;
};

const FeedbackTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});

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
            await upsertFeedbackItem(project.id, item);
            toast.success('Feedback item saved');
          } catch (error) {
            console.error('Error saving feedback item:', error);
            toast.error('Failed to save feedback item');
          }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleCellChange = useCallback(
    (itemId, field, value) => {
      setFeedbackItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );

      const item = feedbackItems.find(i => i.id === itemId);
      if (item) {
        debouncedSave({ ...item, [field]: value });
      }
    },
    [feedbackItems, debouncedSave]
  );

  const handleAddRow = useCallback(() => {
    const maxNumber = Math.max(
      0,
      ...feedbackItems.map(item => item.number || 0)
    );

    const newItem = {
      id: `feedback_${Date.now()}`,
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

  const handleDeleteRow = useCallback(
    async (itemId) => {
      try {
        await deleteFeedbackItem(itemId);
        setFeedbackItems(prev => prev.filter(item => item.id !== itemId));
        toast.success('Feedback item deleted');
      } catch (error) {
        console.error('Error deleting feedback item:', error);
        toast.error('Failed to delete feedback item');
      }
    },
    []
  );

  const sortedItems = useMemo(() => {
    let sorted = [...feedbackItems];

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
  }, [feedbackItems, sortConfig, filters]);

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

  const renderCell = (item, field, itemId) => {
    const value = item[field];
    const isDateField = field === 'due_date_committed';
    const isPriorityField = field === 'delivery_priority';
    const isDevStatusField = field === 'dev_status';
    const isClickupField = field === 'clickup_task_id';

    if (!canEdit) {
      if (isPriorityField) {
        return renderStatusPill(value, PRIORITY_COLORS);
      }
      if (isDevStatusField) {
        return renderStatusPill(value, DEV_STATUS_COLORS);
      }
      if (isClickupField && value) {
        const isUrl = isValidUrl(value);
        return isUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {value}
            <ExternalLink size={14} />
          </a>
        ) : (
          <span>{value}</span>
        );
      }
      if (isDateField) {
        return value ? new Date(value).toLocaleDateString() : '-';
      }
      return value || '-';
    }

    if (isPriorityField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select priority</option>
          {FEEDBACK_PRIORITY_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isDevStatusField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select status</option>
          {FEEDBACK_DEV_STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isDateField) {
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        />
      );
    }

    if (isClickupField) {
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => {
            const input = e.target.value;
            // If it's a URL or looks like a task ID, store the full input
            handleCellChange(itemId, field, input);
          }}
          placeholder="Paste URL or task ID"
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
        <h3 className="text-lg font-semibold">Feedback & Requirements</h3>
        {canEdit && (
          <button
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={18} /> Add Row
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
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
                <td className="px-4 py-2 text-center border-r font-medium">{item.number}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'requirement', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'delivery_priority', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'clickup_task_id', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'dev_status', item.id)}</td>
                <td className="px-4 py-2 border-r">{renderCell(item, 'due_date_committed', item.id)}</td>
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
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
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
