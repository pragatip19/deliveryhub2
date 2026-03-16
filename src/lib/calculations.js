// calculations.js — All formula logic for the project plan

import { addWorkdays, calcPlannedEnd, networkdays, today, parseDate } from './workdays';

// ============================================================
// STATUS HELPERS
// ============================================================
export const STATUS_COLORS = {
  'Not Started': { bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-300', hex: '#D1D5DB' },
  'In Progress': { bg: 'bg-yellow-200', text: 'text-yellow-800', border: 'border-yellow-300', hex: '#FDE68A' },
  'Done':        { bg: 'bg-green-200', text: 'text-green-800', border: 'border-green-300', hex: '#A7F3D0' },
  'Blocked':     { bg: 'bg-red-200',   text: 'text-red-800',   border: 'border-red-300',   hex: '#FCA5A5' },
  'Delayed':     { bg: 'bg-orange-200',text: 'text-orange-800',border: 'border-orange-300',hex: '#FED7AA' },
  'Not Applicable': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', hex: '#F3F4F6' },
};

export function getStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS['Not Started'];
}

// ============================================================
// DEPENDENCY CHAIN — calculate planned_start for a task
// ============================================================
/**
 * Given a task and all tasks in the plan, calculate its planned_start
 * based on the dependency chain rules:
 *
 * - No dependency: return the anchor start (first task planned_start, or today)
 * - Predecessor is Done → use predecessor.current_end + 1 workday
 * - Predecessor is In Progress:
 *     if current_end > planned_end → use current_end + 1 workday (delay cascade)
 *     else → use planned_end + 1 workday
 * - Predecessor is Not Started or Blocked:
 *     use planned_end + 1 workday
 *     but if planned_end < today → cascade delay: planned_end stays as-is
 *       (cascade propagates — the successor will also be delayed)
 */
export function calcPlannedStart(task, allTasks) {
  if (!task.dependency) return task.planned_start ? parseDate(task.planned_start) : null;

  const predecessor = allTasks.find(t =>
    t.activities?.trim().toLowerCase() === task.dependency?.trim().toLowerCase()
  );
  if (!predecessor) return task.planned_start ? parseDate(task.planned_start) : null;

  // If the predecessor's planned_start is locked, don't recalculate
  const predEnd = getPredecessorEnd(predecessor);
  if (!predEnd) return task.planned_start ? parseDate(task.planned_start) : null;

  return addWorkdays(predEnd, 1);
}

/**
 * Get the effective "end date" of a predecessor for dependency calculation
 */
function getPredecessorEnd(pred) {
  const status = pred.status;
  const plannedEnd = parseDate(pred.planned_end);
  const currentEnd = parseDate(pred.current_end);
  const todayDate = today();

  if (status === 'Done') {
    return currentEnd || plannedEnd;
  }
  if (status === 'In Progress') {
    if (currentEnd && plannedEnd && currentEnd > plannedEnd) return currentEnd;
    return plannedEnd;
  }
  // Not Started or Blocked
  if (plannedEnd && plannedEnd < todayDate) {
    // Cascade delay — use today as effective end (delay propagates)
    return todayDate;
  }
  return plannedEnd;
}

// ============================================================
// FULL TASK CALCULATION — computes all derived fields for one task
// ============================================================
export function calculateTask(task, allTasks) {
  const todayDate = today();
  let result = { ...task };

  // 1. Planned Start (if not locked)
  if (!task.planned_start_locked) {
    const ps = calcPlannedStart(task, allTasks);
    if (ps) {
      result.planned_start = ps.toISOString().split('T')[0];
    }
  }

  // 2. Planned End = WORKDAY(planned_start, duration - 1)
  if (result.planned_start && result.duration) {
    const pe = calcPlannedEnd(parseDate(result.planned_start), result.duration);
    if (pe) result.planned_end = pe.toISOString().split('T')[0];
  }

  // 3. Set Baseline once (if not already set)
  if (!task.baseline_locked && result.planned_start && !task.baseline_planned_start) {
    result.baseline_planned_start = result.planned_start;
    result.baseline_planned_end = result.planned_end;
  }

  // 4. Status auto-update
  const prevStatus = task.status;
  if (task.actual_start && !task.current_end) {
    if (prevStatus === 'Not Started' || prevStatus === 'Blocked') {
      result.status = 'In Progress';
      // Lock planned_start on first status → In Progress transition
      if (!task.planned_start_locked) {
        result.planned_start_locked = true;
      }
    }
  }
  if (task.current_end && task.status === 'In Progress') {
    result.status = 'Done';
  }

  // 5. No of Days Delay
  result.no_of_days_delay = calcDaysDelay(result);

  // 6. Delay / On Track
  result.delay_on_track = calcDelayOnTrack(result);

  // 7. Planned Start - Baseline Planned Start
  result.planned_start_vs_baseline = calcVsBaseline(result);

  return result;
}

// ============================================================
// NO OF DAYS DELAY
// ============================================================
export function calcDaysDelay(task) {
  const status = task.status;
  const todayDate = today();

  if (status === 'Not Applicable') return 0;
  if (status === 'Blocked') return 0;

  const baselineStart = parseDate(task.baseline_planned_start);
  const baselineEnd = parseDate(task.baseline_planned_end);
  const plannedEnd = parseDate(task.planned_end);
  const currentEnd = parseDate(task.current_end);

  if (status === 'Not Started') {
    if (!baselineStart) return 0;
    const delay = networkdays(baselineStart, todayDate) - 1;
    return Math.max(0, delay);
  }
  if (status === 'In Progress') {
    if (!plannedEnd) return 0;
    if (todayDate <= plannedEnd) return 0;
    return Math.max(0, networkdays(plannedEnd, todayDate) - 1);
  }
  if (status === 'Done') {
    if (!baselineEnd || !currentEnd) return 0;
    return Math.max(0, networkdays(baselineEnd, currentEnd) - 1);
  }
  return 0;
}

// ============================================================
// DELAY / ON TRACK
// ============================================================
export function calcDelayOnTrack(task) {
  const delay = task.no_of_days_delay || 0;
  const status = task.status;
  if (status === 'Not Applicable' || status === 'Blocked') return '';
  if (status === 'Not Started') return delay > 0 ? 'Delay' : '';
  return delay > 0 ? 'Delay' : 'On Track';
}

// ============================================================
// PLANNED START - BASELINE PLANNED START
// ============================================================
export function calcVsBaseline(task) {
  const status = task.status;
  if (!task.baseline_planned_start) return 0;

  if (status === 'Not Started' || status === 'Blocked') {
    const baseline = parseDate(task.baseline_planned_start);
    const planned = parseDate(task.planned_start);
    if (!baseline || !planned) return 0;
    return networkdays(baseline, planned) - 1;
  } else {
    const baselineEnd = parseDate(task.baseline_planned_end);
    const plannedEnd = parseDate(task.planned_end);
    if (!baselineEnd || !plannedEnd) return 0;
    return networkdays(baselineEnd, plannedEnd) - 1;
  }
}

// ============================================================
// PROJECT HEALTH CALCULATIONS
// ============================================================

/**
 * Get target onboarding days by application category
 */
export function getTargetOnboardingDays(categoryName) {
  const map = {
    'MES': 72, 'DMS': 72, 'AI Investigator': 72, 'LMS': 72, 'AI Agents': 72,
    'Logbooks': 60,
    'CLEEN': 30,
  };
  return map[categoryName] || null;
}

/**
 * SOW Completion % calculations
 * Excludes Not Applicable tasks. Blocked = 0 credit.
 */
export function calcSOWCompletion(tasks) {
  const eligible = tasks.filter(t => t.status !== 'Not Applicable');
  const totalDuration = eligible.reduce((sum, t) => sum + (t.duration || 0), 0);
  if (totalDuration === 0) return { current: 0, expected: 0, delta: 0 };

  const todayDate = today();

  // Current %: Done tasks full credit + In Progress partial credit
  let currentDays = 0;
  eligible.forEach(t => {
    if (t.status === 'Done') {
      currentDays += t.duration || 0;
    } else if (t.status === 'In Progress' && t.actual_start) {
      const elapsed = networkdays(parseDate(t.actual_start), todayDate);
      const credit = Math.min(elapsed, (t.duration || 1) - 1);
      currentDays += Math.max(0, credit);
    }
  });

  // Expected %: tasks where planned_end <= today
  let expectedDays = 0;
  eligible.forEach(t => {
    const pe = parseDate(t.planned_end);
    if (pe && pe <= todayDate) {
      expectedDays += t.duration || 0;
    }
  });

  const current = Math.min(100, (currentDays / totalDuration) * 100);
  const expected = Math.min(100, (expectedDays / totalDuration) * 100);
  const delta = current - expected;

  return { current, expected, delta, isBehind: delta < -5 };
}

/**
 * Get active (In Progress) tasks count
 */
export function getActiveTasks(tasks) {
  return tasks.filter(t => t.status === 'In Progress').length;
}

/**
 * Get kickoff date from tasks (Actual Start of "Conduct Kick-off call" or similar)
 */
export function getKickoffDate(tasks) {
  const kickoffTask = tasks.find(t =>
    t.activities?.toLowerCase().includes('conduct kick-off call') ||
    t.activities?.toLowerCase().includes('conduct kickoff call') ||
    t.activities?.toLowerCase().includes('kick-off call')
  );
  return kickoffTask?.actual_start || null;
}

/**
 * Get projected go-live = Planned End of "Release System" task
 */
export function getProjectedGoLive(tasks) {
  const releaseTask = tasks.find(t =>
    t.activities?.toLowerCase().includes('release system')
  );
  return releaseTask?.planned_end || null;
}

// ============================================================
// RECALCULATE ENTIRE PLAN (topological sort by dependency)
// ============================================================
export function recalculatePlan(tasks) {
  // Build adjacency and run topological ordering
  const byName = {};
  tasks.forEach(t => { byName[t.activities?.trim()] = t; });

  const visited = new Set();
  const result = [];

  function visit(task) {
    if (!task || visited.has(task.id)) return;
    if (task.dependency && byName[task.dependency?.trim()]) {
      visit(byName[task.dependency.trim()]);
    }
    visited.add(task.id);
    result.push(task);
  }

  tasks.forEach(t => visit(t));

  // Now calculate each task in dependency order
  const calculated = {};
  result.forEach(task => {
    const allCalc = Object.values(calculated).concat(
      tasks.filter(t => !calculated[t.id])
    );
    const updated = calculateTask(
      task,
      tasks.map(t => calculated[t.id] || t)
    );
    calculated[task.id] = updated;
  });

  return tasks.map(t => calculated[t.id] || t);
}
