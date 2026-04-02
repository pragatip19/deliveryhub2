// Vercel Serverless Function — Daily Slack alert when project SOW % is behind
// Cron: 15 10 * * * (10:15 UTC = 15:45 IST)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const WEBHOOK_URL  = process.env.SLACK_WEBHOOK_URL;
const DM_SLACK_IDS = JSON.parse(process.env.SLACK_DM_IDS || '{}');
const APP_URL      = 'https://deliveryhub2-igqt.vercel.app';

// ── Date helpers ─────────────────────────────────────────────────────────────

function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }

function networkdays(start, end) {
  let count = 0;
  const cur = new Date(start); cur.setHours(0,0,0,0);
  const fin = new Date(end);   fin.setHours(0,0,0,0);
  if (cur > fin) return 0;
  while (cur <= fin) { if (!isWeekend(cur)) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}

function getWorkingDaysList(start, end) {
  const days = [];
  const cur = new Date(start); cur.setHours(0,0,0,0);
  const fin = new Date(end);   fin.setHours(0,0,0,0);
  while (cur <= fin) { if (!isWeekend(cur)) days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split('T')[0].split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setHours(0,0,0,0);
  return isNaN(dt.getTime()) ? null : dt;
}

function fmtDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayDate() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}

function daysFromToday(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const today = todayDate();
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function getCategoryTargetDays(categoryName) {
  if (!categoryName) return 72;
  const n = categoryName.toLowerCase();
  if (n === 'cleen') return 36;
  if (n.includes('logbook')) return 60;
  return 72;
}

// Replicates getKickoffDate from calculations.js
function getKickoffDate(tasks) {
  const t = tasks.find(t =>
    t.activities?.toLowerCase().includes('conduct kick-off call') ||
    t.activities?.toLowerCase().includes('conduct kickoff call') ||
    t.activities?.toLowerCase().includes('kick-off call')
  );
  return t?.actual_start || null;
}

// Replicates getProjectedGoLive from calculations.js
function getProjectedGoLive(tasks) {
  const t = tasks.find(t => t.activities?.toLowerCase().includes('release system'));
  return t?.planned_end || null;
}

// ── SOW Completion (matches UI logic exactly) ─────────────────────────────────

function calcSOWCompletion(tasks, targetDays) {
  const today = todayDate();

  const eligible = tasks.filter(t => {
    if (!t.planned_start || !t.planned_end) return false;
    if (t.status === 'Not Applicable') return false;
    const s = parseDate(t.planned_start);
    const e = parseDate(t.planned_end);
    return s && e && s <= e;
  });

  if (eligible.length === 0) return null;

  const projectStart = new Date(Math.min(...eligible.map(t => parseDate(t.planned_start).getTime())));
  const projectEnd   = new Date(Math.max(...eligible.map(t => parseDate(t.planned_end).getTime())));
  projectStart.setHours(0,0,0,0); projectEnd.setHours(0,0,0,0);

  const actualSpanDays = getWorkingDaysList(projectStart, projectEnd).length;
  const totalDays      = targetDays || actualSpanDays;
  if (totalDays === 0) return null;

  const projectDays = getWorkingDaysList(projectStart, projectEnd);

  // Store timestamps for comparison
  const stamped = eligible.map(t => {
    const s = parseDate(t.planned_start); s.setHours(0,0,0,0);
    const e = parseDate(t.planned_end);   e.setHours(0,0,0,0);
    return { ...t, _s: s.getTime(), _e: e.getTime() };
  });

  const weights = {};
  eligible.forEach(t => { weights[t.id] = 0; });

  for (const day of projectDays) {
    const ts = day.getTime();
    const active = stamped.filter(t => ts >= t._s && ts <= t._e);
    if (active.length === 0) continue;
    const share = 1 / (totalDays * active.length);
    active.forEach(t => { weights[t.id] += share; });
  }

  const currentFrac = eligible
    .filter(t => t.status === 'Done')
    .reduce((sum, t) => sum + weights[t.id], 0);

  let expectedFrac;
  const todayNorm = new Date(today);
  if (todayNorm < projectStart) {
    expectedFrac = 0;
  } else {
    expectedFrac = networkdays(projectStart, todayNorm) / totalDays;
  }

  const current  = Math.min(100, currentFrac  * 100);
  const expected = Math.min(100, expectedFrac * 100);
  const delta    = current - expected;

  return {
    current:   Math.round(current  * 10) / 10,
    expected:  Math.round(expected * 10) / 10,
    behindPct: Math.round(Math.max(0, -delta) * 10) / 10,
  };
}

// ── Supabase fetch ────────────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase error on ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!WEBHOOK_URL)                   return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set' });

  try {
    const projects = await sbGet(
      'projects?select=id,name,dm_id,kickoff_date,planned_go_live,projected_go_live,sow_current_pct,sow_expected_pct,sow_behind_pct,sow_computed_at,categories(name)'
    );
    const profiles = await sbGet('profiles?select=id,email,full_name');
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

    const log  = [`${projects.length} projects, ${profiles.length} profiles loaded`];
    const sent = [];
    const today = todayDate();

    for (const proj of projects) {
      const dm = proj.dm_id ? profileMap[proj.dm_id] : null;

      // Fetch tasks — needed for go-live display and as fallback for SOW if stored values are missing
      const tasks = await sbGet(
        `project_plan?select=id,activities,planned_start,planned_end,actual_start,status` +
        `&project_id=eq.${proj.id}`
      );
      const projGoLiveStr = getProjectedGoLive(tasks) || proj.projected_go_live;

      // Use stored SOW values if available (written by Health page), otherwise compute inline
      // Derive behindPct from current+expected (same as Hub card) — never read sow_behind_pct directly
      let sow;
      if (proj.sow_current_pct !== null && proj.sow_current_pct !== undefined &&
          proj.sow_expected_pct !== null && proj.sow_expected_pct !== undefined) {
        const behindPct = Math.round(Math.max(0, proj.sow_expected_pct - proj.sow_current_pct) * 10) / 10;
        sow = {
          current:   proj.sow_current_pct,
          expected:  proj.sow_expected_pct,
          behindPct,
        };
        log.push(`${proj.name}: ${sow.current}% actual, ${sow.expected}% expected, ${sow.behindPct}% behind (stored)`);
      } else {
        // Replicate Health page's sowDenominator exactly: networkdays(firstTask, projGoLive)
        const eligible = tasks.filter(t => t.planned_start && t.planned_end && t.status !== 'Not Applicable');
        const firstTaskDate = eligible.length > 0
          ? new Date(Math.min(...eligible.map(t => parseDate(t.planned_start).getTime())))
          : null;
        const projGoLive = parseDate(projGoLiveStr);
        const sowDenominator = firstTaskDate && projGoLive
          ? networkdays(firstTaskDate, projGoLive)
          : null;
        sow = calcSOWCompletion(tasks, sowDenominator);
        if (!sow) { log.push(`${proj.name}: no eligible tasks — skipped`); continue; }
        log.push(`${proj.name}: ${sow.current}% actual, ${sow.expected}% expected, ${sow.behindPct}% behind (computed, denom=${sowDenominator}d)`);
      }

      // Only alert if >10% behind
      if (sow.behindPct <= 10) { log.push(`  → within threshold, no alert`); continue; }

      // Fetch DM action items (not Done)
      const dmActions = await sbGet(
        `dm_actions?select=text,status,by_when,impact` +
        `&project_id=eq.${proj.id}` +
        `&status=not.in.(Done)` +
        `&order=sort_order`
      );
      const pendingActions = dmActions.filter(a => a.text?.trim());

      // Fetch payments due within 5 days (not yet paid)
      const payments = await sbGet(
        `payments?select=line_item,payment_status,planned_milestone_completion_date` +
        `&project_id=eq.${proj.id}` +
        `&payment_status=in.(Not%20Paid,Invoice%20Sent,Project%20Pending)`
      );
      const upcomingPayments = payments.filter(p => {
        const days = daysFromToday(p.planned_milestone_completion_date);
        return days !== null && days >= 0 && days <= 5;
      });

      // Go-live date to display
      const goLiveDisplay = fmtDate(projGoLiveStr || proj.planned_go_live);

      // DM mention
      const slackId  = dm ? DM_SLACK_IDS[dm.email] : null;
      const dmName   = dm?.full_name || 'Delivery Manager';
      const mention  = slackId ? `<@${slackId}>` : `*${dmName}*`;

      // Build Slack blocks
      const blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🚨 Project Delayed: ${proj.name}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*DM*\n${mention}` },
            { type: 'mrkdwn', text: `*Go-Live Date*\n📅 ${goLiveDisplay}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📉 *Schedule Status:* This project is *${sow.behindPct}% behind schedule.*`,
          },
        },
      ];

      // DM Next Action Items
      if (pendingActions.length > 0) {
        const actionLines = pendingActions.map(a => {
          const due = a.by_when ? ` — due *${fmtDate(a.by_when)}*` : '';
          const status = a.status === 'In Progress' ? ' _(In Progress)_' : '';
          return `• ${a.text}${due}${status}`;
        }).join('\n');
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `📋 *Next Action Items:*\n${actionLines}` },
        });
      }

      // Upcoming payment milestones
      if (upcomingPayments.length > 0) {
        const payLines = upcomingPayments.map(p => {
          const days = daysFromToday(p.planned_milestone_completion_date);
          const urgency = days === 0 ? 'due *today*' : `due in *${days} day${days === 1 ? '' : 's'}* (${fmtDate(p.planned_milestone_completion_date)})`;
          return `• ${p.line_item || 'Payment milestone'} — ${urgency}`;
        }).join('\n');

        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💳 *Upcoming Payment Milestones:*\n${payLines}\n\n_If you're unable to meet a date, please update the planned milestone completion date in the app._`,
          },
        });
      }

      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Please review and update the project plan to reflect the latest progress.\n👉 <${APP_URL}/project/${proj.id}|Open ${proj.name} in Delivery Hub>`,
        },
      });
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Delivery Hub · Auto-check daily · Alert stops when delay drops below 5%` }],
      });

      const slackRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 ${proj.name} is ${sow.behindPct}% behind schedule (DM: ${dmName})`,
          blocks,
        }),
      });

      if (slackRes.ok) sent.push(`${proj.name} (${sow.behindPct}% behind)`);
      else log.push(`❌ Slack post failed for ${proj.name}: ${slackRes.status}`);
    }

    return res.status(200).json({
      message: sent.length > 0 ? `Sent ${sent.length} alert(s)` : '✅ No projects above 10% delay threshold.',
      sent,
      log,
    });

  } catch (err) {
    console.error('slack-alert error:', err);
    return res.status(500).json({ error: err.message });
  }
}
