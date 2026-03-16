import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Download,
  Plus,
  Trash2,
  Filter,
  ArrowUpDown,
  Link as LinkIcon,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import debounce from 'lodash.debounce';
import {
  getPlanTasks,
  bulkUpsertPlanTasks,
  upsertPlanTask,
  deletePlanTask,
  getMilestones,
  getPeople,
} from '../../../lib/supabase';
import {
  PLAN_COLUMNS,
  STATUS_OPTIONS,
} from '../../../lib/templates';
import {
  recalculatePlan,
  calculateTask,
  getStatusColor,
} from '../../../lib/calculations';
import {
  calcPlannedEnd,
  formatDate,
  formatDateInput,
  parseDate,
  networkdays,
} from '../../../lib/workdays';
import StatusBadge from '../../shared/StatusBadge';

const ProjectPlan = ({ project, canEdit }) => {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [people, setPeople] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({});
  const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
  const [filterConfig, setFilterConfig] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Define all columns with metadata
  const COLUMNS = [
    { key: 'milestone', label: 'Milestone', width: 180, frozen: true },
    { key: 'activities', label: 'Activities', width: 240, frozen: true },
    { key: 'tools', label: 'Tools', width: 160, frozen: false },
    { key: 'owner', label: 'Owner', width: 160, frozen: false },
    { key: 'status', label: 'Status', width: 130, frozen: false },
    { key: 'duration', label: 'Duration', width: 90, frozen: false },
    { key: 'baseline_planned_start', label: 'Baseline Planned Start', width: 140, frozen: false },
    { key: 'baseline_planned_end', label: 'Baseline Planned End', width: 140, frozen: false },
    { key: 'planned_start', label: 'Planned Start', width: 120, frozen: false },
    { key: 'planned_end', label: 'Planned End', width: 120, frozen: false },
    { key: 'actual_start', label: 'Actual Start', width: 120, frozen: false },
    { key: 'current_end', label: 'Current End', width: 120, frozen: false },
    { key: 'dependency', label: 'Dependency', width: 200, frozen: false },
    { key: 'deviation', label: 'Deviation', width: 120, frozen: false },
    { key: 'deviation_details', label: 'Deviation Details', width: 200, frozen: false },
    { key: 'delay_status', label: 'Delay/On Track', width: 120, frozen: false },
    { key: 'days_delay', label: 'No of Days Delay', width: 120, frozen: false },
    { key: 'baseline_delta', label: 'Planned Start - Baseline', width: 200, frozen: false },
    { key: 'learnings', label: 'Learnings from Delay', width: 200, frozen: false },
  ];

  const isAdmin = canEdit && project?.role === 'admin';
  const isDM = canEdit && (project?.role === 'admin' || project?.role === 'dm');

  // Initialize visible columns
  useEffect(() => {
    const initialVisible = {};
    COLUMNS.forEach(col => {
      initialVisible[col.key] = true;
    });
    setVisibleColumns(initialVisible);
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tasksData, milestonesData, peopleData] = await Promise.all([
          getPlanTasks(project.id),
          getMilestones(project.id),
          getPeople(project.id),
        ]);

        setTasks(tasksData || []);
        setMilestones(milestonesData || []);
        setPeople(peopleData || []);

        // Run full recalculation on load
        if (tasksData && tasksData.length > 0) {
          const recalculated = recalculatePlan(tasksData);
          setTasks(recalculated);
        }
      } catch (error) {
        console.error('Error loading plan data:', error);
        toast.error('Failed to load project plan');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [project?.id]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (updates) => {
      try {
        await bulkUpsertPlanTasks(project.id, updates);
        toast.success('Changes saved');
      } catch (error) {
        console.error('Save error:', error);
        toast.error('Failed to save changes');
      }
    }, 800),
    [project?.id]
  );

  // Handle cell change
  const handleCellChange = useCallback((rowIndex, columnKey, value) => {
    setTasks(prevTasks => {
      const newTasks = [...prevTasks];
      const task = newTasks[rowIndex];

      if (!task) return prevTasks;

      const oldValue = task[columnKey];

      // Parse date values
      if (columnKey.includes('start') || columnKey.includes('end')) {
        task[columnKey] = parseDate(value);
      } else if (columnKey === 'duration') {
        task[columnKey] = parseInt(value) || 0;
      } else {
        task[columnKey] = value;
      }

      // Auto-set status based on actual_start/current_end
      if (columnKey === 'actual_start' && value && task.status === 'Not Started') {
        task.status = 'In Progress';
        task.planned_start_locked = true;
      }
      if (columnKey === 'current_end' && value && task.status === 'In Progress') {
        task.status = 'Done';
      }

      // Baseline auto-copy
      if (columnKey === 'planned_start' && !task.baseline_planned_start && value) {
        task.baseline_planned_start = value;
        task.baseline_locked = true;
      }

      // Recalculate planned_end
      if (columnKey === 'planned_start' || columnKey === 'duration') {
        task.planned_end = calcPlannedEnd(task.planned_start, task.duration);
      }

      // Recalculate delay/on track
      if (task.planned_end && task.current_end) {
        const delay = networkdays(task.planned_end, task.current_end);
        task.delay_status = delay > 0 ? 'Delay' : 'On Track';
        task.days_delay = Math.max(0, delay);
      }

      // Dependency cascade
      if (columnKey === 'dependency' || columnKey === 'duration' || columnKey === 'status') {
        const recalculated = recalculatePlan(newTasks, rowIndex);
        return recalculated;
      }

      debouncedSave([task]);
      return newTasks;
    });

    setEditingCell(null);
  }, [debouncedSave]);

  // Handle row add
  const handleAddRow = async () => {
    try {
      const newTask = {
        project_id: project.id,
        activities: 'New Activity',
        status: 'Not Started',
        duration: 0,
      };

      const created = await upsertPlanTask(project.id, newTask);
      setTasks([...tasks, created]);
      toast.success('Row added');
    } catch (error) {
      console.error('Error adding row:', error);
      toast.error('Failed to add row');
    }
  };

  // Handle row delete
  const handleDeleteRow = async (rowIndex) => {
    if (!isAdmin) {
      toast.error('Only admins can delete rows');
      return;
    }

    try {
      const task = tasks[rowIndex];
      if (task.id) {
        await deletePlanTask(project.id, task.id);
      }
      setTasks(tasks.filter((_, i) => i !== rowIndex));
      toast.success('Row deleted');
    } catch (error) {
      console.error('Error deleting row:', error);
      toast.error('Failed to delete row');
    }
  };

  // Handle paste from Excel
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const rows = text.split('\n').filter(row => row.trim());

    if (rows.length === 0) return;

    const newTasks = [];
    rows.forEach(row => {
      const values = row.split('\t');
      const newTask = {
        project_id: project.id,
        activities: values[0] || '',
        tools: values[1] || '',
        owner: values[2] || '',
        status: values[3] || 'Not Started',
        duration: parseInt(values[4]) || 0,
      };
      newTasks.push(newTask);
    });

    setTasks([...tasks, ...newTasks]);
    debouncedSave(newTasks);
    toast.success(`${newTasks.length} rows pasted`);
  };

  // Render cell content
  const renderCellContent = (task, columnKey, rowIndex) => {
    const value = task[columnKey];
    let isReadOnly = false;
    let isEditable = false;

    // Determine editability
    switch (columnKey) {
      case 'milestone':
        isEditable = isAdmin;
        isReadOnly = !isAdmin;
        break;
      case 'activities':
      case 'tools':
      case 'owner':
      case 'status':
      case 'duration':
      case 'dependency':
      case 'deviation':
      case 'deviation_details':
      case 'learnings':
        isEditable = isDM;
        isReadOnly = !isDM;
        break;
      case 'baseline_planned_start':
      case 'baseline_planned_end':
        isEditable = isAdmin;
        isReadOnly = !isAdmin;
        break;
      case 'planned_start':
        // Only DM can edit first task, others read-only
        isEditable = isDM && (rowIndex === 0 || !task.planned_start_locked);
        isReadOnly = !isEditable;
        break;
      case 'actual_start':
      case 'current_end':
        isEditable = isDM;
        isReadOnly = !isDM;
        break;
      case 'planned_end':
      case 'delay_status':
      case 'days_delay':
      case 'baseline_delta':
        isReadOnly = true;
        break;
      default:
        isReadOnly = true;
    }

    // Render based on column type
    if (columnKey === 'status') {
      return (
        <div
          className={`px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(value)}`}
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
        >
          {value || 'Not Started'}
        </div>
      );
    }

    if (columnKey === 'delay_status') {
      const bgColor = value === 'Delay' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
      return (
        <div className={`px-2 py-1 rounded text-sm font-medium ${bgColor}`}>
          {value || '—'}
        </div>
      );
    }

    if (columnKey.includes('start') || columnKey.includes('end')) {
      return (
        <div
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
          className={isEditable ? 'cursor-pointer hover:bg-blue-50' : ''}
        >
          {value ? formatDate(value) : '—'}
        </div>
      );
    }

    if (columnKey === 'tools') {
      if (value && value.startsWith('http')) {
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
            {value}
          </a>
        );
      }
      return <div className="truncate">{value || ''}</div>;
    }

    if (columnKey === 'owner') {
      return (
        <div
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
          className={isEditable ? 'cursor-pointer hover:bg-blue-50' : ''}
        >
          {people.find(p => p.id === value)?.name || value || '—'}
        </div>
      );
    }

    if (columnKey === 'milestone') {
      return (
        <div
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
          className={isEditable ? 'cursor-pointer hover:bg-blue-50' : ''}
        >
          {milestones.find(m => m.id === value)?.name || value || '—'}
        </div>
      );
    }

    return (
      <div
        onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
        className={`truncate ${isEditable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
      >
        {value || '—'}
      </div>
    );
  };

  // Render cell editor
  const renderCellEditor = (task, columnKey, rowIndex) => {
    const value = task[columnKey];

    if (columnKey === 'status') {
      return (
        <select
          value={value || 'Not Started'}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          autoFocus
        >
          {STATUS_OPTIONS.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      );
    }

    if (columnKey === 'owner') {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          autoFocus
        >
          <option value="">—</option>
          {people.map(person => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>
      );
    }

    if (columnKey === 'milestone') {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          autoFocus
        >
          <option value="">—</option>
          {milestones.map(milestone => (
            <option key={milestone.id} value={milestone.id}>{milestone.name}</option>
          ))}
        </select>
      );
    }

    if (columnKey.includes('start') || columnKey.includes('end')) {
      return (
        <input
          type="date"
          value={value ? formatDateInput(value) : ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          autoFocus
        />
      );
    }

    if (columnKey === 'duration') {
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          autoFocus
        />
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
        className="w-full px-2 py-1 border border-gray-300 rounded"
        autoFocus
      />
    );
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    Object.entries(filterConfig).forEach(([key, filterValue]) => {
      if (!filterValue) return;
      result = result.filter(task => {
        const taskValue = String(task[key]).toLowerCase();
        return taskValue.includes(filterValue.toLowerCase());
      });
    });

    return result;
  }, [tasks, filterConfig]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    if (!sortConfig.column) return filteredTasks;

    return [...filteredTasks].sort((a, b) => {
      const aVal = a[sortConfig.column] || '';
      const bVal = b[sortConfig.column] || '';

      let comparison = 0;
      if (typeof aVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredTasks, sortConfig]);

  // Export to Excel
  const handleExport = () => {
    const headers = COLUMNS.filter(col => visibleColumns[col.key]).map(col => col.label);
    const rows = sortedTasks.map(task =>
      COLUMNS.filter(col => visibleColumns[col.key]).map(col => task[col.key] || '')
    );

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-plan.csv`;
    a.click();
    toast.success('Plan exported');
  };

  if (loading) {
    return <div className="text-center py-8">Loading project plan...</div>;
  }

  const frozenCols = COLUMNS.filter(col => col.frozen);
  const scrollableCols = COLUMNS.filter(col => !col.frozen);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-800">{project.name} › Project Plan</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-2"
          >
            <Eye size={18} />
            Hide/Show Columns
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-2"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Column visibility menu */}
      {showColumnMenu && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="font-semibold mb-3">Show/Hide Columns</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key] !== false}
                  onChange={(e) =>
                    setVisibleColumns({
                      ...visibleColumns,
                      [col.key]: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">{col.label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => setShowColumnMenu(false)}
            className="mt-4 px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            Close
          </button>
        </div>
      )}

      {/* Main table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto max-h-[600px]" onPaste={handlePaste}>
          <table className="w-full border-collapse">
            {/* Header */}
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="w-10 sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700">
                  #
                </th>

                {frozenCols.map((col) =>
                  visibleColumns[col.key] !== false && (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className="sticky left-12 z-20 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() =>
                        setSortConfig({
                          column: col.key,
                          direction: sortConfig.column === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
                        })
                      }
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown size={14} className="opacity-50" />
                      </div>
                      {filterConfig[col.key] && (
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={filterConfig[col.key]}
                          onChange={(e) =>
                            setFilterConfig({
                              ...filterConfig,
                              [col.key]: e.target.value,
                            })
                          }
                          className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  )
                )}

                {scrollableCols.map((col) =>
                  visibleColumns[col.key] !== false && (
                    <th
                      key={col.key}
                      style={{ width: col.width, minWidth: col.width }}
                      className="border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() =>
                        setSortConfig({
                          column: col.key,
                          direction: sortConfig.column === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
                        })
                      }
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown size={14} className="opacity-50" />
                      </div>
                      {filterConfig[col.key] && (
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={filterConfig[col.key]}
                          onChange={(e) =>
                            setFilterConfig({
                              ...filterConfig,
                              [col.key]: e.target.value,
                            })
                          }
                          className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  )
                )}

                {isAdmin && <th className="w-10 border-b border-gray-200 px-2 py-2" />}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {sortedTasks.map((task, rowIndex) => (
                <tr key={task.id || rowIndex} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-2 py-2 text-xs font-semibold text-gray-500 text-center">
                    {rowIndex + 1}
                  </td>

                  {frozenCols.map((col) =>
                    visibleColumns[col.key] !== false && (
                      <td
                        key={`${rowIndex}-${col.key}`}
                        style={{ width: col.width }}
                        className="sticky left-12 bg-white border-r border-gray-200 px-3 py-2 text-sm"
                      >
                        {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                          renderCellEditor(task, col.key, rowIndex)
                        ) : (
                          renderCellContent(task, col.key, rowIndex)
                        )}
                      </td>
                    )
                  )}

                  {scrollableCols.map((col) =>
                    visibleColumns[col.key] !== false && (
                      <td
                        key={`${rowIndex}-${col.key}`}
                        style={{ width: col.width, minWidth: col.width }}
                        className="border-r border-gray-200 px-3 py-2 text-sm"
                      >
                        {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                          renderCellEditor(task, col.key, rowIndex)
                        ) : (
                          renderCellContent(task, col.key, rowIndex)
                        )}
                      </td>
                    )
                  )}

                  {isAdmin && (
                    <td className="border-gray-200 px-2 py-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add row button */}
      {canEdit && (
        <button
          onClick={handleAddRow}
          className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-2"
        >
          <Plus size={18} />
          Add Row
        </button>
      )}
    </div>
  );
};

export default ProjectPlan;
