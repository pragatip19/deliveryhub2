// calculations.js — All formula logic for the project plan

import { addWorkdays, calcPlannedEnd, networkdays, today, parseDate, toDateStr } from './workdays';

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
      result.planned_start = toDateStr(ps);
    }
  }

  // 2. Planned End = WORKDAY(planned_start, duration - 1)
  if (result.planned_start && result.duration) {
    const pe = calcPlannedEnd(parseDate(result.planned_start), result.duration);
    if (pe) result.planned_end = toDateStr(pe);
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

  // 5. Days Delay  (field key must match COLUMNS definition: 'days_delay')
  result.days_delay = calcDaysDelay(result);

  // 6. Delay / On Track  (field key must match COLUMNS definition: 'delay_status')
  result.delay_status = calcDelayOnTrack(result);

  // 7. Baseline Delta  (field key must match COLUMNS definition: 'baseline_delta')
  result.baseline_delta = calcVsBaseline(result);

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
  const delay = task.days_delay || 0;
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
  if (!categoryName) return 72;
  const name = categoryName.toLowerCase();
  if (name === 'cleen') return 36;
  if (name === 'logbooks') return 60;
  return 72; // MES, DMS, AI Investigator, LMS, AI Agents, and all others
}

// ── Private helper ────────────────────────────────────────────────────────────
/**
 * Returns an array of local-midnight Date objects for every Mon–Fri
 * between startDate and endDate (inclusive).
 */
function getWorkingDaysList(startDate, endDate) {
  const days = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Overlap-adjusted SOW Completion % calculations.
 *
 * WEIGHTING LOGIC
 * ───────────────
 * Denominator = targetDays (projected onboarding days: 72 / 60 / 36).
 * Every working day carries equal weight: 1 / targetDays.
 * On a day with N parallel active tasks, each task earns:
 *   1 / (targetDays × N)
 * A task's total weight = sum of its daily earnings across all its active days.
 *
 * CURRENT %   = sum of weights of tasks where status = "Done"
 *               (can exceed targetDays' share if tasks overlap heavily)
 * EXPECTED %  = elapsed working days from project start to today
 *               ÷ targetDays  (pure time, capped at 100 %)
 *
 * @param {Array}  tasks       - task objects with planned_start, planned_end, status
 * @param {number} targetDays  - projected onboarding days (72 / 60 / 36); falls back
 *                               to actual task span if omitted
 * @param {Date}   [todayOverride] - optional override for "today" (useful for testing)
 *
 * EXCLUSIONS: tasks missing dates, planned_start > planned_end, status = "Not Applicable"
 */
export function calcSOWCompletion(tasks, targetDays, todayOverride) {
  const todayDate = todayOverride || today();

  // 1. Filter eligible tasks
  const eligible = tasks.filter(t => {
    if (!t.planned_start || !t.planned_end) return false;
    if (t.status === 'Not Applicable') return false;
    const s = parseDate(t.planned_start);
    const e = parseDate(t.planned_end);
    return s && e && s <= e;
  });

  if (eligible.length === 0) return { current: 0, expected: 0, delta: 0, isBehind: false };

  // 2. Project timeline boundaries (from actual task dates)
  const projectStart = new Date(Math.min(...eligible.map(t => parseDate(t.planned_start).getTime())));
  const projectEnd   = new Date(Math.max(...eligible.map(t => parseDate(t.planned_end).getTime())));
  projectStart.setHours(0, 0, 0, 0);
  projectEnd.setHours(0, 0, 0, 0);

  // 3. Denominator: use targetDays (72/60/36) if provided, else derive from task span
  const actualSpanDays = getWorkingDaysList(projectStart, projectEnd).length;
  const totalDays      = targetDays || actualSpanDays;
  if (totalDays === 0) return { current: 0, expected: 0, delta: 0, isBehind: false };

  // 4. Enumerate every working day tasks actually cover (for parallelism analysis)
  const projectDays = getWorkingDaysList(projectStart, projectEnd);

  // 5. Pre-stamp each task's start/end as timestamps for fast comparison
  const stamped = eligible.map(t => ({
    ...t,
    _s: parseDate(t.planned_start).setHours(0, 0, 0, 0),
    _e: parseDate(t.planned_end).setHours(0, 0, 0, 0),
  }));

  // 6. Accumulate per-task weights — each day's share divided by active task count
  const weights = {};
  eligible.forEach(t => { weights[t.id] = 0; });

  for (const day of projectDays) {
    const ts = day.getTime();
    const active = stamped.filter(t => ts >= t._s && ts <= t._e);
    if (active.length === 0) continue;                         // gap day — skip
    const share = 1 / (totalDays * active.length);            // uses targetDays as denominator
    active.forEach(t => { weights[t.id] += share; });
  }

  // 7. Current % = sum of weights for all "Done" tasks
  const currentFrac = eligible
    .filter(t => t.status === 'Done')
    .reduce((sum, t) => sum + weights[t.id], 0);

  // 8. Expected % = elapsed working days since project start / targetDays (time only)
  const todayNorm = new Date(todayDate);
  todayNorm.setHours(0, 0, 0, 0);

  let expectedFrac;
  if (todayNorm < projectStart) {
    expectedFrac = 0;                                          // before project start
  } else {
    const elapsed = networkdays(projectStart, todayNorm);
    expectedFrac  = elapsed / totalDays;                       // can exceed 1 if overdue
  }

  const current  = Math.min(100, currentFrac  * 100);
  const expected = Math.min(100, expectedFrac * 100);
  const delta    = current - expected;

  return {
    current:     Math.round(current  * 10) / 10,
    expected:    Math.round(expected * 10) / 10,
    delta:       Math.round(delta    * 10) / 10,
    isBehind:    delta < -5,
    taskWeights: weights,    // exposed for debugging / future per-task views
  };
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
// RECALCULATE ALL DATES FROM ANCHOR (pure chain — no today-comparison)
// ============================================================
/**
 * Given the anchor planned_start for the first task, cascade planned dates
 * through the entire dependency chain using only durations and working days.
 * No comparison to today — pure forward calculation.
 * Also sets baseline_planned_start and baseline_planned_end to match.
 *
 * @param {Array}        tasks       — full task array in sort_order
 * @param {string|Date}  anchorStart — planned_start of the anchor (first) task
 * @returns tasks array in ORIGINAL order with updated planned + baseline dates
 */
export function recalcAllDatesFromAnchor(tasks, anchorStart) {
  if (!tasks.length || !anchorStart) return tasks;

  const anchor = typeof anchorStart === 'string' ? parseDate(anchorStart) : new Date(anchorStart);
  if (!anchor) return tasks;
  anchor.setHours(0, 0, 0, 0);

  // Map activity name → task for dependency lookups
  const byName = {};
  tasks.forEach(t => { if (t.activities?.trim()) byName[t.activities.trim()] = t; });

  // Topological sort (visit predecessor before successor)
  const visited = new Set();
  const order   = [];
  function visit(task) {
    if (!task || visited.has(task.id)) return;
    const dep = task.dependency?.trim();
    if (dep && byName[dep]) visit(byName[dep]);
    visited.add(task.id);
    order.push(task);
  }
  tasks.forEach(t => visit(t));

  // Forward-calculate dates in topo order
  const calculated = {};
  for (const task of order) {
    const dep     = task.dependency?.trim();
    const predCal = dep ? calculated[byName[dep]?.id] : null;

    let ps;
    if (predCal?.planned_end) {
      const predEnd = parseDate(predCal.planned_end);
      ps = predEnd ? addWorkdays(predEnd, 1) : new Date(anchor);
    } else {
      ps = new Date(anchor);   // no predecessor → start at anchor
    }
    ps.setHours(0, 0, 0, 0);

    const duration = Math.max(1, task.duration || 1);
    const pe = calcPlannedEnd(ps, duration);

    const psStr = toDateStr(ps);
    const peStr = pe ? toDateStr(pe) : psStr;

    // Only overwrite baseline if it hasn't been explicitly locked by the user
    const baselineAlreadyLocked = task.baseline_locked === true;
    calculated[task.id] = {
      ...task,
      planned_start:          psStr,
      planned_end:            peStr,
      baseline_planned_start: baselineAlreadyLocked ? task.baseline_planned_start : psStr,
      baseline_planned_end:   baselineAlreadyLocked ? task.baseline_planned_end   : peStr,
      planned_start_locked:   false,
    };
  }

  // Always return sorted by sort_order — deterministic, prevents state drift
  return tasks
    .map(t => calculated[t.id] || t)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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

  // Always sort by sort_order on the way out — prevents any state ordering drift
  return tasks
    .map(t => calculated[t.id] || t)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}
