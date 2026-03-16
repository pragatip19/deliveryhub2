import React from 'react';

const STATUS_COLORS = {
  'Not Started': 'bg-gray-200 text-gray-700',
  'In Progress': 'bg-yellow-200 text-yellow-800',
  'Done': 'bg-green-200 text-green-800',
  'Blocked': 'bg-red-200 text-red-800',
  'Delayed': 'bg-orange-200 text-orange-800',
  'Not Applicable': 'bg-gray-100 text-gray-400'
};

const SIZE_CLASSES = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm'
};

export default function StatusBadge({ status = 'Not Started', size = 'md' }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-200 text-gray-600';
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span
      className={`inline-block font-medium rounded-full whitespace-nowrap ${colorClass} ${sizeClass}`}
    >
      {status}
    </span>
  );
}
