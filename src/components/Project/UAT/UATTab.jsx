import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUATItems, upsertUATItem, deleteUATItem, getPeople } from '../../../lib/supabase';
import { MES_UAT_TEMPLATE, LOGBOOKS_UAT_TEMPLATE, UAT_STATUS_OPTIONS, UAT_BATCH_STATUS_OPTIONS } from '../../../lib/templates';
import { useAuth } from '../../../contexts/AuthContext';
import DataTable from '../../Common/DataTable';

const STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'Ready for UAT': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Under Reconfig': 'bg-orange-100 text-orange-800',
  'UAT Complete': 'bg-green-100 text-green-800',
  'Signed Off': 'bg-emerald-100 text-emerald-800',
};

const BATCH_STATUS_COLORS = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Done': 'bg-green-100 text-green-800',
  'Blocked': 'bg-red-100 text-red-800',
};

const UATTab = ({ project, canEdit }) => {
  const { user, isAdmin, isDM } = useAuth();
  const [uatItems, setUatItems] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [batchDates, setBatchDates] = useState({
    batch_1_start: null,
    batch_1_end: null,
    batch_2_start: null,
    batch_2_end: null,
    batch_3_start: null,
    batch_3_end: null,
  });

  const isMESUAT = project?.uat_type === 'mes';
  const isLogbooksUAT = project?.uat_type === 'logbooks';
  const canDeleteRows = isAdmin() || isDM();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [items, peopleList] = await Promise.all([
          getUATItems(project.id),
          getPeople(project.id),
        ]);
        setUatItems(items || []);
        setPeople(peopleList || []);

        // Extract batch dates from config row if exists
        const configRow = items?.find(item => item.group_name === '__batch_config');
        if (configRow) {
          setBatchDates({
            batch_1_start: configRow.batch_1_start,
            batch_1_end: configRow.batch_1_end,
            batch_2_start: configRow.batch_2_start,
            batch_2_end: configRow.batch_2_end,
            batch_3_start: configRow.batch_3_start,
            batch_3_end: configRow.batch_3_end,
          });
        }
      } catch (error) {
        console.error('Error loading UAT data:', error);
        toast.error('Failed to load UAT data');
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
            await upsertUATItem(project.id, item);
            toast.success('UAT item saved');
          } catch (error) {
            console.error('Error saving UAT item:', error);
            toast.error('Failed to save UAT item');
          }
        }, 800);
      };
    })(),
    [project.id]
  );

  const handleCellChange = useCallback(
    (itemId, field, value) => {
      setUatItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );

      const item = uatItems.find(i => i.id === itemId);
      if (item) {
        debouncedSave({ ...item, [field]: value });
      }
    },
    [uatItems, debouncedSave]
  );

  const handleBatchDateChange = useCallback(
    (batchNum, dateType, value) => {
      const key = `batch_${batchNum}_${dateType}`;
      setBatchDates(prev => ({ ...prev, [key]: value }));

      // Save to config row
      const configRow = uatItems.find(item => item.group_name === '__batch_config');
      const configData = configRow || {
        id: `batch_config_${project.id}`,
        project_id: project.id,
        group_name: '__batch_config',
        process_name: 'Batch Configuration',
      };

      debouncedSave({
        ...configData,
        [key]: value,
      });
    },
    [uatItems, project.id, debouncedSave]
  );

  const handleAddRow = useCallback(
    (groupName) => {
      const newItem = {
        id: `uat_${Date.now()}`,
        project_id: project.id,
        group_name: groupName,
        process_name: '',
        status: 'Not Started',
        uat_approver_id: null,
        ...(isMESUAT && {
          batch_1_start: null,
          batch_1_end: null,
          batch_1_status: 'Not Started',
          batch_2_start: null,
          batch_2_end: null,
          batch_2_status: 'Not Started',
          batch_3_start: null,
          batch_3_end: null,
          batch_3_status: 'Not Started',
          paper_fields: 0,
          eliminated: 0,
          automated: 0,
          controlled: 0,
          remaining: 0,
          interlocks: 0,
          compliance_score: 0,
        }),
        ...(isLogbooksUAT && {
          paper_fields: 0,
          eliminated: 0,
          automated: 0,
          controlled: 0,
          remaining: 0,
          interlocks: 0,
          compliance_score: 0,
        }),
      };

      setUatItems(prev => [...prev, newItem]);
      debouncedSave(newItem);
    },
    [project.id, isMESUAT, isLogbooksUAT, debouncedSave]
  );

  const handleDeleteRow = useCallback(
    async (itemId) => {
      try {
        await deleteUATItem(itemId);
        setUatItems(prev => prev.filter(item => item.id !== itemId));
        toast.success('UAT item deleted');
      } catch (error) {
        console.error('Error deleting UAT item:', error);
        toast.error('Failed to delete UAT item');
      }
    },
    []
  );

  const groupedItems = useMemo(() => {
    const groups = isMESUAT
      ? ['BMR', 'BPR', 'Logbooks / Processes']
      : ['Logbooks / Processes'];

    return groups.reduce((acc, group) => {
      acc[group] = uatItems.filter(
        item => item.group_name === group && item.group_name !== '__batch_config'
      );
      return acc;
    }, {});
  }, [uatItems, isMESUAT]);

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
    const isDateField = field.includes('_start') || field.includes('_end');
    const isNumberField = ['paper_fields', 'eliminated', 'automated', 'controlled', 'remaining', 'interlocks', 'compliance_score'].includes(field);
    const isStatusField = field === 'status';
    const isBatchStatusField = field.includes('batch') && field.includes('status');
    const isApproverField = field === 'uat_approver_id';

    if (!canEdit) {
      if (isStatusField || isBatchStatusField) {
        return renderStatusPill(value, isStatusField ? STATUS_COLORS : BATCH_STATUS_COLORS);
      }
      if (isDateField) {
        return value ? new Date(value).toLocaleDateString() : '-';
      }
      if (isApproverField) {
        const person = people.find(p => p.id === value);
        return person?.name || '-';
      }
      return value || '-';
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

    if (isStatusField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select status</option>
          {UAT_STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isBatchStatusField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select status</option>
          {UAT_BATCH_STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (isApproverField) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(itemId, field, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="">Select approver</option>
          {people.map(person => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>
      );
    }

    if (isNumberField) {
      return (
        <input
          type="number"
          value={value || 0}
          onChange={(e) => handleCellChange(itemId, field, parseInt(e.target.value) || 0)}
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
    <div className="space-y-8 p-6">
      {isMESUAT && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">MES UAT Tracker</h3>

          {/* Batch Date Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold mb-4">Batch Dates Configuration</h4>
            <div className="grid grid-cols-6 gap-4">
              {[1, 2, 3].map(batchNum => (
                <div key={`batch_${batchNum}`} className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch {batchNum} Start
                    </label>
                    <input
                      type="date"
                      value={batchDates[`batch_${batchNum}_start`] || ''}
                      onChange={(e) => handleBatchDateChange(batchNum, 'start', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch {batchNum} End
                    </label>
                    <input
                      type="date"
                      value={batchDates[`batch_${batchNum}_end`] || ''}
                      onChange={(e) => handleBatchDateChange(batchNum, 'end', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UAT Table */}
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-left font-semibold border-r w-40">Process Name</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-32">Status</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-40">UAT Approver</th>
                  <th colSpan="3" className="px-4 py-2 text-center font-semibold border-r">Batch 1</th>
                  <th colSpan="3" className="px-4 py-2 text-center font-semibold border-r">Batch 2</th>
                  <th colSpan="3" className="px-4 py-2 text-center font-semibold border-r">Batch 3</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-24">Paper Fields</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Eliminated</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Automated</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Controlled</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Remaining</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Interlocks</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-28">Compliance Score</th>
                  <th className="px-4 py-2 text-center font-semibold w-12">Actions</th>
                </tr>
                <tr className="bg-gray-50 border-b">
                  <th colSpan="3" className="px-4 py-2"></th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">Start</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">End</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">Status</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">Start</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">End</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">Status</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">Start</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">End</th>
                  <th className="px-4 py-2 text-center font-semibold border-r text-xs">Status</th>
                  <th colSpan="7"></th>
                </tr>
              </thead>
              <tbody>
                {['BMR', 'BPR', 'Logbooks / Processes'].map(groupName => (
                  <React.Fragment key={groupName}>
                    {/* Group Header */}
                    <tr className="bg-gray-100 border-b">
                      <td colSpan="20" className="px-4 py-2 font-bold">{groupName}</td>
                    </tr>
                    {/* Group Rows */}
                    {groupedItems[groupName]?.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'process_name', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'status', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'uat_approver_id', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_1_start', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_1_end', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_1_status', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_2_start', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_2_end', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_2_status', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_3_start', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_3_end', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'batch_3_status', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'paper_fields', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'eliminated', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'automated', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'controlled', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'remaining', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'interlocks', item.id)}</td>
                        <td className="px-4 py-2 border-r">{renderCell(item, 'compliance_score', item.id)}</td>
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
                    {/* Add Row Button */}
                    <tr className="bg-gray-50 border-b">
                      <td colSpan="20" className="px-4 py-2">
                        {canEdit && (
                          <button
                            onClick={() => handleAddRow(groupName)}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            <Plus size={16} /> Add Row
                          </button>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLogbooksUAT && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Logbooks UAT Tracker</h3>

          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-left font-semibold border-r w-40">Process Name</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-32">Status</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-40">UAT Approver</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-24">Paper Fields</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Eliminated</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Automated</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Controlled</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Remaining</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-20">Interlocks</th>
                  <th className="px-4 py-2 text-left font-semibold border-r w-28">Compliance Score</th>
                  <th className="px-4 py-2 text-center font-semibold w-12">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Group Header */}
                <tr className="bg-gray-100 border-b">
                  <td colSpan="11" className="px-4 py-2 font-bold">Logbooks / Processes</td>
                </tr>
                {/* Rows */}
                {groupedItems['Logbooks / Processes']?.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'process_name', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'status', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'uat_approver_id', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'paper_fields', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'eliminated', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'automated', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'controlled', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'remaining', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'interlocks', item.id)}</td>
                    <td className="px-4 py-2 border-r">{renderCell(item, 'compliance_score', item.id)}</td>
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
                {/* Add Row Button */}
                <tr className="bg-gray-50 border-b">
                  <td colSpan="11" className="px-4 py-2">
                    {canEdit && (
                      <button
                        onClick={() => handleAddRow('Logbooks / Processes')}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <Plus size={16} /> Add Row
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UATTab;
