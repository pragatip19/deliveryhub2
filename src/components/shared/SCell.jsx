/**
 * SCell — Spreadsheet-style editable table cell.
 *
 * Props:
 *   ss        useSpreadsheet() instance
 *   rowId     unique row identifier
 *   colKey    column key string
 *   value     current value
 *   onChange  (newValue) => void — called immediately on change (for debounced save)
 *   rows      ordered array of row objects with .id  (for Enter navigation)
 *   cols      ordered array of column key strings    (for Tab navigation)
 *   type      'text' | 'number' | 'date' | 'select' | 'colored-select'
 *   options   for select types: string[] or {value, label}[]
 *   colorMap  for 'colored-select': { value: 'tailwind classes' }
 *   readView  React node rendered in read mode (defaults to value || '—')
 *   disabled  if true, not editable
 *   placeholder
 *   tdClass   extra classes for the <td>
 *   tdStyle   inline style for the <td>
 */
import { useState, useEffect, useRef } from 'react';

export function SCell({
  ss, rowId, colKey, value, onChange, rows, cols,
  type = 'text', options, colorMap,
  readView, disabled = false,
  placeholder = '', tdClass = '', tdStyle,
}) {
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);
  const tdRef    = useRef(null);
  const editing  = ss.isEdit(rowId, colKey) && !disabled;
  const selected = ss.isSel(rowId, colKey) && !editing;

  // Keep draft in sync when external value changes
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  // Auto-focus the input when entering edit mode
  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
    if (inputRef.current.select) inputRef.current.select();
  }, [editing]);

  // Auto-focus the <td> when cell is selected (not editing) so it
  // can receive keyboard events (Enter to start editing)
  useEffect(() => {
    if (selected && tdRef.current) {
      tdRef.current.focus({ preventScroll: true });
    }
  }, [selected]);

  function commit(v) {
    const next = v !== undefined ? v : draft;
    if (next !== (value ?? '')) onChange(next);
    ss.blur();
  }

  const inputBase = 'w-full h-full text-xs bg-transparent border-0 focus:outline-none px-1.5 py-0.5';

  // Colored-select: background color from colorMap
  const selBg = (colorMap && type === 'colored-select') ? (colorMap[draft] || 'bg-white text-gray-700') : '';

  const editNode = (type === 'select' || type === 'colored-select') ? (
    <select
      ref={inputRef}
      value={draft}
      onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
      onBlur={() => ss.blur()}
      onKeyDown={e => ss.keyDown(e, rowId, colKey, rows, cols)}
      className={`${inputBase} ${selBg} rounded`}
    >
      <option value="">—</option>
      {(options || []).map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  ) : (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
      onBlur={() => commit()}
      onKeyDown={e => ss.keyDown(e, rowId, colKey, rows, cols)}
      className={inputBase}
    />
  );

  // Default read view
  const readContent = readView !== undefined
    ? readView
    : (value != null && value !== ''
        ? <span className="text-gray-800">{value}</span>
        : <span className="text-gray-400 italic text-[10px]">{placeholder || '—'}</span>);

  return (
    <td
      ref={tdRef}
      tabIndex={selected ? 0 : -1}
      className={`border-r border-gray-200 cursor-default select-none ${ss.cellCls(rowId, colKey)} ${tdClass}`}
      style={tdStyle}
      onClick={() => !disabled && ss.click(rowId, colKey)}
      onKeyDown={e => {
        if (editing) return; // handled by input/select inside
        if (e.key === 'Enter' && !disabled) {
          e.preventDefault();
          ss.click(rowId, colKey); // second click → enters edit
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          ss.keyDown(e, rowId, colKey, rows, cols);
        } else if (e.key === 'Tab') {
          ss.keyDown(e, rowId, colKey, rows, cols);
        }
      }}
    >
      {editing
        ? <div className="min-h-[24px] flex items-center">{editNode}</div>
        : <div className="px-2 py-1 text-xs min-h-[24px] flex items-center">{readContent}</div>
      }
    </td>
  );
}
