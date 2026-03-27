/**
 * useSpreadsheet — Excel-style cell selection & navigation hook.
 *
 * Behaviour:
 *   • 1st click on a cell  → select  (blue outline, no input yet)
 *   • 2nd click on same    → edit    (input shown, blue solid border)
 *   • Enter                → commit + move to next row (same column)
 *   • Tab / Shift+Tab      → commit + move right / left
 *   • Escape               → exit edit, keep selection
 *   • Click elsewhere      → deselect
 */
import { useState, useCallback } from 'react';

export function useSpreadsheet() {
  const [sel,  setSel]  = useState(null); // { rowId, colKey }
  const [edit, setEdit] = useState(null); // { rowId, colKey }

  /** Called when user clicks a cell. */
  const click = useCallback((rowId, colKey) => {
    setSel(prev => {
      const alreadySel = prev?.rowId === rowId && prev?.colKey === colKey;
      if (alreadySel) {
        setEdit({ rowId, colKey });
      } else {
        setEdit(null);
      }
      return { rowId, colKey };
    });
  }, []);

  /**
   * Call this from onKeyDown of the edit input/select.
   * rows  — the ordered array of row objects (must have .id)
   * cols  — ordered array of column key strings
   */
  const keyDown = useCallback((e, rowId, colKey, rows, cols) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const ri   = rows.findIndex(r => r.id === rowId);
      const next = rows[ri + 1];
      if (next) {
        setSel({ rowId: next.id, colKey });
        setEdit({ rowId: next.id, colKey });
      } else {
        setEdit(null);
        setSel({ rowId, colKey });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ci      = cols.indexOf(colKey);
      const nextCol = cols[e.shiftKey ? ci - 1 : ci + 1];
      if (nextCol !== undefined) {
        setSel({ rowId, colKey: nextCol });
        setEdit({ rowId, colKey: nextCol });
      } else {
        // Wrap to next/prev row
        const ri      = rows.findIndex(r => r.id === rowId);
        const nextRow = rows[e.shiftKey ? ri - 1 : ri + 1];
        if (nextRow) {
          const wrapCol = e.shiftKey ? cols[cols.length - 1] : cols[0];
          setSel({ rowId: nextRow.id, colKey: wrapCol });
          setEdit({ rowId: nextRow.id, colKey: wrapCol });
        } else {
          setEdit(null);
        }
      }
    } else if (e.key === 'Escape') {
      setEdit(null);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const ri = rows.findIndex(r => r.id === rowId);
      const next = rows[ri + 1];
      if (next) { setSel({ rowId: next.id, colKey }); setEdit(null); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const ri = rows.findIndex(r => r.id === rowId);
      const prev = rows[ri - 1];
      if (prev) { setSel({ rowId: prev.id, colKey }); setEdit(null); }
    }
  }, []);

  const blur = useCallback(() => setEdit(null), []);

  const clearAll = useCallback(() => { setSel(null); setEdit(null); }, []);

  const isSel  = (rowId, colKey) => sel?.rowId  === rowId && sel?.colKey  === colKey;
  const isEdit = (rowId, colKey) => edit?.rowId === rowId && edit?.colKey === colKey;

  /** CSS classes to apply to a <td> element. */
  const cellCls = (rowId, colKey) => {
    if (isEdit(rowId, colKey)) return 'outline outline-2 outline-blue-500 bg-white relative z-10';
    if (isSel(rowId, colKey))  return 'outline outline-1 outline-blue-300 bg-blue-50/40';
    return '';
  };

  return { click, keyDown, blur, isSel, isEdit, cellCls, clearAll };
}
