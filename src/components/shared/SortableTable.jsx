import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Funnel, X } from 'lucide-react';

export default function SortableTable({
  columns = [],
  data = [],
  onRowClick = null,
  className = ''
}) {
  const [sortConfig, setSortConfig] = useState(null);
  const [filterConfig, setFilterConfig] = useState({});
  const [showFilterInput, setShowFilterInput] = useState(null);

  const handleSort = (columnKey, isSortable) => {
    if (!isSortable) return;

    setSortConfig((prev) => {
      if (prev?.key === columnKey) {
        return prev.direction === 'asc'
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  const handleFilter = (columnKey, filterValue) => {
    setFilterConfig((prev) => ({
      ...prev,
      [columnKey]: filterValue.trim() ? filterValue : undefined
    }));
  };

  const clearFilter = (columnKey) => {
    setFilterConfig((prev) => {
      const newConfig = { ...prev };
      delete newConfig[columnKey];
      return newConfig;
    });
    setShowFilterInput(null);
  };

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      return Object.entries(filterConfig).every(([columnKey, filterValue]) => {
        if (!filterValue) return true;
        const cellValue = String(row[columnKey] || '').toLowerCase();
        return cellValue.includes(filterValue.toLowerCase());
      });
    });
  }, [data, filterConfig]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [filteredData, sortConfig]);

  return (
    <div className={`overflow-x-auto rounded-lg border border-slate-200 ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-sm font-semibold text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <button
                      onClick={() => handleSort(column.key, column.sortable)}
                      className={`flex items-center gap-1 ${
                        column.sortable ? 'cursor-pointer hover:text-slate-900' : ''
                      }`}
                    >
                      <span>{column.label}</span>
                      {column.sortable && sortConfig?.key === column.key && (
                        <>
                          {sortConfig.direction === 'asc' ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </>
                      )}
                    </button>
                  </div>

                  {column.filterable && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowFilterInput(
                            showFilterInput === column.key ? null : column.key
                          )
                        }
                        className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                          filterConfig[column.key] ? 'text-blue-600' : 'text-slate-400'
                        }`}
                        title="Filter"
                      >
                        <Funnel size={16} />
                      </button>

                      {showFilterInput === column.key && (
                        <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[200px]">
                          <input
                            type="text"
                            placeholder={`Filter ${column.label}...`}
                            value={filterConfig[column.key] || ''}
                            onChange={(e) => handleFilter(column.key, e.target.value)}
                            autoFocus
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                          />
                          {filterConfig[column.key] && (
                            <button
                              onClick={() => clearFilter(column.key)}
                              className="mt-2 w-full text-xs text-slate-600 hover:text-slate-900 py-1 flex items-center justify-center gap-1"
                            >
                              <X size={14} />
                              Clear
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-8 text-center text-slate-500"
              >
                No data found
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-200 transition-colors ${
                  rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                } ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 text-sm text-slate-700">
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
