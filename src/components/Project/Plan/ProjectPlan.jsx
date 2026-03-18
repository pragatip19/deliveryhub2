import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  Plus,
  Trash2,
  ArrowUpDown,
  MoreVertical,
  Undo2,
  Redo2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import debounce from 'lodash.debounce';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getPlanTasks,
  bulkUpsertPlanTasks,
  upsertPlanTask,
  deletePlanTask,
  getMilestones,
  getPeople,
} from '../../../lib/supabase';
import { STATUS_OPTIONS } from '../../../lib/templates';
import {
  recalculatePlan,
  getStatusColor,
} from '../../../lib/calculations';
import {
  calcPlannedEnd,
  formatDate,
  formatDateInput,
  parseDate,
  networkdays,
} from '../../../lib/workdays';

const ProjectPlan = ({ project, canEdit }) => {
  const { isAdmin: isAdminFn } = useAuth();
  const isProjectAdmin = canEdit && isAdminFn();
  const isDM = canEdit; // anyone with edit access (admin or DM of this project)

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
  const [openMenuRow, setOpenMenuRow] = useState(null);

  // Undo/redo history
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const scrollContainerRef = useRef(null);

  // Define all columns
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

  // Initialize visible columns
  useEffect(() => {
    const initialVisible = {};
    COLUMNS.forEach(col => { initialVisible[col.key] = true; });
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

        const tasksArr = tasksData || [];
        setMilestones(milestonesData || []);
        setPeople(peopleData || []);

        const recalculated = tasksArr.length > 0 ? recalculatePlan(tasksArr) : tasksArr;
        setTasks(recalculated);
        pushHistory(recalculated);
      } catch (error) {
        console.error('Error loading plan data:', error);
        toast.error('Failed to load project plan');
      } finally {
        setLoading(false);
      }
    };
    if (project?.id) loadData();
  }, [project?.id]);

  // History helpers
  function pushHistory(newTasks) {
    if (isUndoRedoRef.current) return;
    const snapshot = JSON.parse(JSON.stringify(newTasks));
    // Truncate any future states
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    historyIndexRef.current = historyRef.current.length - 1;
  }

  // Debounced save — correct signature: bulkUpsertPlanTasks(tasks)
  const debouncedSave = useCallback(
    debounce(async (updatedTasks) => {
      try {
        const tasksWithProject = updatedTasks.map(t => ({ ...t, project_id: project.id }));
        await bulkUpsertPlanTasks(tasksWithProject);
        toast.success('Changes saved');
      } catch (error) {
        console.error('Save error:', error);
        toast.error('Failed to save: ' + (error.message || 'Unknown error'));
      }
    }, 800),
    [project?.id]
  );

  // Undo
  function undo() {
    if (historyIndexRef.current <= 0) { toast('Nothing to undo'); return; }
    historyIndexRef.current--;
    isUndoRedoRef.current = true;
    const prev = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
    setTasks(prev);
    debouncedSave(prev);
    isUndoRedoRef.current = false;
  }

  // Redo
  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) { toast('Nothing to redo'); return; }
    historyIndexRef.current++;
    isUndoRedoRef.current = true;
    const next = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
    setTasks(next);
    debouncedSave(next);
    isUndoRedoRef.current = false;
  }

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close three-dots menu on outside click
  useEffect(() => {
    const handler = () => setOpenMenuRow(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Handle cell change
  const handleCellChange = useCallback((rowIndex, columnKey, value) => {
    setTasks(prevTasks => {
      const newTasks = [...prevTasks];
      const task = { ...newTasks[rowIndex] };
      if (!task) return prevTasks;

      // Parse date values
      if (columnKey.includes('start') || columnKey.includes('end')) {
        task[columnKey] = value || null;
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

      // Baseline auto-copy on first planned_start entry
      if (columnKey === 'planned_start' && !task.baseline_planned_start && value) {
        task.baseline_planned_start = value;
        task.baseline_locked = true;
      }

      // Recalculate planned_end
      if (columnKey === 'planned_start' || columnKey === 'duration') {
        if (task.planned_start && task.duration) {
          task.planned_end = calcPlannedEnd(task.planned_start, task.duration);
        }
      }

      // Recalculate delay
      if (task.planned_end && task.current_end) {
        const delay = networkdays(task.planned_end, task.current_end);
        task.delay_status = delay > 0 ? 'Delay' : 'On Track';
        task.days_delay = Math.max(0, delay);
      }

      newTasks[rowIndex] = task;

      // Dependency cascade
      let finalTasks = newTasks;
      if (['dependency', 'duration', 'status', 'planned_start'].includes(columnKey)) {
        finalTasks = recalculatePlan(newTasks);
      }

      pushHistory(finalTasks);
      debouncedSave(finalTasks);
      return finalTasks;
    });

    setEditingCell(null);
  }, [debouncedSave]);

  // Add row — correct signature: upsertPlanTask(task)
  const handleAddRow = async () => {
    try {
      const newTask = {
        project_id: project.id,
        activities: 'New Activity',
        status: 'Not Started',
        duration: 0,
        sort_order: tasks.length,
      };
      const created = await upsertPlanTask(newTask);
      const updated = [...tasks, created];
      setTasks(updated);
      pushHistory(updated);
      toast.success('Row added');
    } catch (error) {
      console.error('Error adding row:', error);
      toast.error('Failed to add row: ' + (error.message || ''));
    }
  };

  // Delete row — correct signature: deletePlanTask(id)
  const handleDeleteRow = async (rowIndex) => {
    if (!isDM) { toast.error('No edit access'); return; }
    if (!window.confirm('Delete this row?')) return;
    try {
      const task = tasks[rowIndex];
      if (task.id && !String(task.id).startsWith('temp-')) {
        await deletePlanTask(task.id);
      }
      const updated = tasks.filter((_, i) => i !== rowIndex);
      setTasks(updated);
      pushHistory(updated);
      setOpenMenuRow(null);
      toast.success('Row deleted');
    } catch (error) {
      console.error('Error deleting row:', error);
      toast.error('Failed to delete: ' + (error.message || ''));
    }
  };

  // Handle paste from Excel
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const rows = text.split('\n').filter(row => row.trim());
    if (rows.length === 0) return;

    const newTaskObjs = rows.map(row => {
      const values = row.split('\t');
      return {
        project_id: project.id,
        activities: values[0] || '',
        tools: values[1] || '',
        owner: values[2] || '',
        status: values[3] || 'Not Started',
        duration: parseInt(values[4]) || 0,
        sort_order: tasks.length,
      };
    });

    const updated = [...tasks, ...newTaskObjs];
    setTasks(updated);
    pushHistory(updated);
    debouncedSave(updated);
    toast.success(`${newTaskObjs.length} rows pasted`);
  };

  // Determine cell editability
  const getCellEditability = (task, columnKey, rowIndex) => {
    switch (columnKey) {
      case 'milestone':
        return isProjectAdmin;
      case 'activities':
      case 'tools':
      case 'owner':
      case 'status':
      case 'duration':
      case 'dependency':
      case 'deviation':
      case 'deviation_details':
      case 'learnings':
        return isDM;
      case 'baseline_planned_start':
      case 'baseline_planned_end':
        return isProjectAdmin;
      case 'planned_start':
        // First row always editable by DM; others only if not locked
        return isDM && (rowIndex === 0 || !task.planned_start_locked);
      case 'actual_start':
      case 'current_end':
        return isDM;
      case 'planned_end':
      case 'delay_status':
      case 'days_delay':
      case 'baseline_delta':
      default:
        return false;
    }
  };

  // Render cell content
  const renderCellContent = (task, columnKey, rowIndex) => {
    const value = task[columnKey];
    const isEditable = getCellEditability(task, columnKey, rowIndex);

    if (columnKey === 'status') {
      const colors = getStatusColor(value);
      return (
        <div
          className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block ${colors.bg} ${colors.text} ${isEditable ? 'cursor-pointer' : ''}`}
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
        >
          {value || 'Not Started'}
        </div>
      );
    }

    if (columnKey === 'delay_status') {
      const bgColor = value === 'Delay' ? 'bg-red-100 text-red-700' : value === 'On Track' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500';
      return <div className={`px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>{value || '—'}</div>;
    }

    if (columnKey.includes('start') || columnKey.includes('end')) {
      return (
        <div
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
          className={`text-xs ${isEditable ? 'cursor-pointer hover:bg-blue-50 rounded px-1' : 'text-gray-500'}`}
        >
          {value ? formatDate(value) : <span className="text-gray-300">—</span>}
        </div>
      );
    }

    if (columnKey === 'days_delay') {
      return <span className={`text-xs font-medium ${value > 0 ? 'text-red-600' : 'text-gray-400'}`}>{value > 0 ? `+${value}d` : '—'}</span>;
    }

    if (columnKey === 'tools' && value && value.startsWith('http')) {
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs hover:text-blue-800 truncate block">{value}</a>;
    }

    if (columnKey === 'owner') {
      const person = people.find(p => p.id === value);
      return (
        <div
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
          className={`text-xs truncate ${isEditable ? 'cursor-pointer hover:bg-blue-50 rounded px-1' : ''}`}
        >
          {person?.name || value || <span className="text-gray-300">—</span>}
        </div>
      );
    }

    if (columnKey === 'milestone') {
      const ms = milestones.find(m => m.id === value);
      return (
        <div
          onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
          className={`text-xs truncate font-medium ${isEditable ? 'cursor-pointer hover:bg-blue-50 rounded px-1' : ''}`}
        >
          {ms?.name || value || <span className="text-gray-300">—</span>}
        </div>
      );
    }

    return (
      <div
        onClick={() => isEditable && setEditingCell({ row: rowIndex, col: columnKey })}
        className={`text-xs truncate ${isEditable ? 'cursor-pointer hover:bg-blue-50 rounded px-1' : ''}`}
      >
        {value ?? <span className="text-gray-300">—</span>}
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
          className="w-full px-1 py-0.5 border border-blue-400 rounded text-xs focus:outline-none"
          autoFocus
          onBlur={() => setEditingCell(null)}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    }

    if (columnKey === 'owner') {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-1 py-0.5 border border-blue-400 rounded text-xs focus:outline-none"
          autoFocus
          onBlur={() => setEditingCell(null)}
        >
          <option value="">—</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      );
    }

    if (columnKey === 'milestone') {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-1 py-0.5 border border-blue-400 rounded text-xs focus:outline-none"
          autoFocus
          onBlur={() => setEditingCell(null)}
        >
          <option value="">—</option>
          {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      );
    }

    if (columnKey.includes('start') || columnKey.includes('end')) {
      return (
        <input
          type="date"
          value={value ? formatDateInput(parseDate(value)) : ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-1 py-0.5 border border-blue-400 rounded text-xs focus:outline-none"
          autoFocus
          onBlur={() => setEditingCell(null)}
        />
      );
    }

    if (columnKey === 'duration') {
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
          className="w-full px-1 py-0.5 border border-blue-400 rounded text-xs focus:outline-none"
          autoFocus
          onBlur={() => setEditingCell(null)}
          min={1}
        />
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => handleCellChange(rowIndex, columnKey, e.target.value)}
        className="w-full px-1 py-0.5 border border-blue-400 rounded text-xs focus:outline-none"
        autoFocus
        onBlur={() => setEditingCell(null)}
      />
    );
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    Object.entries(filterConfig).forEach(([key, filterValue]) => {
      if (!filterValue) return;
      result = result.filter(task => String(task[key] || '').toLowerCase().includes(filterValue.toLowerCase()));
    });
    return result;
  }, [tasks, filterConfig]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    if (!sortConfig.column) return filteredTasks;
    return [...filteredTasks].sort((a, b) => {
      const aVal = a[sortConfig.column] || '';
      const bVal = b[sortConfig.column] || '';
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredTasks, sortConfig]);

  // Export to CSV
  const handleExport = () => {
    const visibleCols = COLUMNS.filter(col => visibleColumns[col.key] !== false);
    const headers = visibleCols.map(col => col.label);
    const rows = sortedTasks.map(task => visibleCols.map(col => task[col.key] || ''));
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-plan.csv`;
    a.click();
    toast.success('Plan exported');
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading project plan...</div>;

  const frozenCols = COLUMNS.filter(col => col.frozen && visibleColumns[col.key] !== false);
  const scrollableCols = COLUMNS.filter(col => !col.frozen && visibleColumns[col.key] !== false);
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">{project.name} › Project Plan</h2>
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Undo2 size={15} className="text-slate-600" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Redo2 size={15} className="text-slate-600" />
          </button>

          <div className="w-px h-4 bg-slate-200" />

          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
          >
            <Eye size={14} />
            Columns
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Column visibility menu */}
      {showColumnMenu && (
        <div className="bg-white p-4 rounded-xl shadow border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Show/Hide Columns</h3>
            <button onClick={() => setShowColumnMenu(false)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key] !== false}
                  onChange={(e) => setVisibleColumns({ ...visibleColumns, [col.key]: e.target.checked })}
                  className="rounded"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto max-h-[600px]" onPaste={handlePaste}>
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8 sticky left-0 z-20 bg-slate-50 border-r border-slate-200 px-2 py-2 text-slate-500 font-medium">#</th>

                {frozenCols.map(col => (
                  <th key={col.key} style={{ width: col.width, minWidth: col.width }}
                    className="sticky left-8 z-20 bg-slate-50 border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => setSortConfig({ column: col.key, direction: sortConfig.column === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center gap-1">{col.label}<ArrowUpDown size={11} className="opacity-40" /></div>
                  </th>
                ))}

                {scrollableCols.map(col => (
                  <th key={col.key} style={{ width: col.width, minWidth: col.width }}
                    className="border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => setSortConfig({ column: col.key, direction: sortConfig.column === col.key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center gap-1">{col.label}<ArrowUpDown size={11} className="opacity-40" /></div>
                  </th>
                ))}

                {/* Three-dots column header */}
                {isDM && <th className="w-8 border-slate-200 bg-slate-50" />}
              </tr>
            </thead>

            <tbody>
              {sortedTasks.map((task, rowIndex) => (
                <tr key={task.id || rowIndex} className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-2 py-1.5 text-center text-slate-400 font-medium group-hover:bg-slate-50">
                    {rowIndex + 1}
                  </td>

                  {frozenCols.map(col => (
                    <td key={`${rowIndex}-${col.key}`} style={{ width: col.width, minWidth: col.width }}
                      className="sticky left-8 bg-white border-r border-slate-100 px-3 py-1.5 group-hover:bg-slate-50">
                      {editingCell?.row === rowIndex && editingCell?.col === col.key
                        ? renderCellEditor(task, col.key, rowIndex)
                        : renderCellContent(task, col.key, rowIndex)}
                    </td>
                  ))}

                  {scrollableCols.map(col => (
                    <td key={`${rowIndex}-${col.key}`} style={{ width: col.width, minWidth: col.width }}
                      className="border-r border-slate-100 px-3 py-1.5">
                      {editingCell?.row === rowIndex && editingCell?.col === col.key
                        ? renderCellEditor(task, col.key, rowIndex)
                        : renderCellContent(task, col.key, rowIndex)}
                    </td>
                  ))}

                  {/* Three-dots menu per row */}
                  {isDM && (
                    <td className="px-1 py-1.5 relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuRow(openMenuRow === rowIndex ? null : rowIndex); }}
                        className="p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition"
                      >
                        <MoreVertical size={13} className="text-slate-500" />
                      </button>
                      {openMenuRow === rowIndex && (
                        <div className="absolute right-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[130px] py-1">
                          <button
                            onClick={() => handleDeleteRow(rowIndex)}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={12} /> Delete Row
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {sortedTasks.length === 0 && (
                <tr>
                  <td colSpan={frozenCols.length + scrollableCols.length + 2} className="text-center py-12 text-slate-400 text-sm">
                    No tasks yet. Click "Add Row" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add row button */}
      {canEdit && (
        <button
          onClick={handleAddRow}
          className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-2 text-sm font-medium transition border border-emerald-200"
        >
          <Plus size={15} />
          Add Row
        </button>
      )}
    </div>
  );
};

export default ProjectPlan;
