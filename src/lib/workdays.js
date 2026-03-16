// workdays.js — WORKDAY and NETWORKDAYS logic (no weekends)

/**
 * Returns true if a date falls on a weekend (Sat/Sun)
 */
export function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Add `n` workdays to a date (positive or negative).
 * Equivalent to Excel WORKDAY(start, n)
 */
export function addWorkdays(startDate, n) {
  if (!startDate) return null;
  const date = new Date(startDate);
  if (isNaN(date.getTime())) return null;
  let remaining = Math.abs(n);
  const direction = n >= 0 ? 1 : -1;
  while (remaining > 0) {
    date.setDate(date.getDate() + direction);
    if (!isWeekend(date)) remaining--;
  }
  return date;
}

/**
 * Calculate planned_end = WORKDAY(planned_start, duration - 1)
 * Duration 1 = same day (0 extra workdays)
 */
export function calcPlannedEnd(plannedStart, duration) {
  if (!plannedStart || !duration) return null;
  return addWorkdays(plannedStart, duration - 1);
}

/**
 * Count workdays between two dates (inclusive of both ends).
 * Equivalent to Excel NETWORKDAYS(start, end)
 * Returns 0 if start > end
 */
export function networkdays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Format a date as "D MMM YY" (e.g. "1 Jan 26")
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/**
 * Format date for HTML date input (YYYY-MM-DD)
 */
export function formatDateInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a date string to a Date object
 */
export function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Get today as a Date with time zeroed out
 */
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Count workdays elapsed since a start date (up to today)
 */
export function workdaysElapsedSince(startDate) {
  if (!startDate) return 0;
  return networkdays(startDate, today());
}

/**
 * Get the next workday on or after a given date
 */
export function nextWorkday(date) {
  const d = new Date(date);
  while (isWeekend(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}
