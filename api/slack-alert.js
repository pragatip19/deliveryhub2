// Vercel Serverless Function — Daily Slack alert when project SOW % is behind
// Cron: 0 16 * * * (16:00 UTC = 21:30 IST)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const WEBHOOK_URL  = process.env.SLACK_WEBHOOK_URL;
const DM_SLACK_IDS = JSON.parse(process.env.SLACK_DM_IDS || '{}');

// ── Helpers (replicated from calculations.js / workdays.js) ──────────────────

function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }

function networkdays(start, end) {
  let count = 0;
  const cur = new Date(start); cur.setHours(0,0,0,0);
  const fin = new Date(end);   fin.setHours(0,0,0,0);
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

function getCategoryTargetDays(categoryName) {
  if (!categoryName) return 72;
  const n = categoryName.toLowerCase();
  if (n === 'cleen') return 36;
  if (n.includes('logbook')) return 60;
  return 72;
}

function calcSOWCompletion(tasks, targetDays) {
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);

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
  const stamped = eligible.map(t => ({ ...t, _s: parseDate(t.planned_start).setHours(0,0,0,0), _e: parseDate(t.planned_end).setHours(0,0,0,0) }));
  const weights = {}; eligible.forEach(t => { weights[t.id] = 0; });

  for (const day of projectDays) {
    const ts = day.getTime();
    const active = stamped.filter(t => ts >= t._s && ts <= t._e);
    if (active.length === 0) continue;
    const share = 1 / (totalDays * active.length);
    active.forEach(t => { weights[t.id] += share; });
  }

  const currentFrac = eligible.filter(t => t.status === 'Done').reduce((sum, t) => sum + weights[t.id], 0);

  let expectedFrac;
  if (todayDate < projectStart) {
    expectedFrac = 0;
  } else {
    const elapsed = networkdays(projectStart, todayDate);
    expectedFrac  = elapsed / totalDays;
  }

  const current  = Math.min(100, currentFrac  * 100);
  const expected = Math.min(100, expectedFrac * 100);
  const delta    = current - expected; // negative = behind

  return {
    current:  Math.round(current  * 10) / 10,
    expected: Math.round(expected * 10) / 10,
    delta:    Math.round(delta    * 10) / 10,
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
  if (!WEBHOOK_URL)            return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set' });

  try {
    const projects = await sbGet('projects?select=id,name,dm_id,category_name,target_sow_completion_days');
    const profiles = await sbGet('profiles?select=id,email,full_name');
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

    const log = [`${projects.length} projects, ${profiles.length} profiles loaded`];
    const sent = [];

    for (const proj of projects) {
      if (!proj.dm_id) continue;
      const dm = profileMap[proj.dm_id];
      if (!dm) continue;

      // Fetch plan tasks for this project
      const tasks = await sbGet(
        `project_plan?select=id,activities,planned_start,planned_end,status` +
        `&project_id=eq.${proj.id}`
      );

      const targetDays = proj.target_sow_completion_days || getCategoryTargetDays(proj.category_name);
      const sow = calcSOWCompletion(tasks, targetDays);

      if (!sow) { log.push(`${proj.name}: no eligible tasks`); continue; }

      log.push(`${proj.name}: ${sow.current}% current, ${sow.expected}% expected, ${sow.behindPct}% behind`);

      // Alert if >10% behind, stop alerting if <5% behind
      if (sow.behindPct < 5) { log.push(`  → within threshold, no alert`); continue; }
      if (sow.behindPct <= 10) { log.push(`  → between 5-10%, no alert`); continue; }

      const slackId = DM_SLACK_IDS[dm.email];
      const mention = slackId ? `<@${slackId}>` : dm.full_name;

      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `🚨 Project Delayed: ${proj.name}`, emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hi ${mention}! 👋 Your project *${proj.name}* is *${sow.behindPct}% behind schedule*.\n\n` +
              `• Expected completion: *${sow.expected}%*\n` +
              `• Actual completion: *${sow.current}%*\n\n` +
              `Please review the project plan and update task statuses.`,
          },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Delivery Hub · <https://deliveryhub2-igqt.vercel.app|Open App> · This alert repeats daily until delay drops below 5%` }],
        },
      ];

      const slackRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🚨 ${proj.name} is ${sow.behindPct}% behind schedule`, blocks }),
      });

      if (slackRes.ok) sent.push(`${proj.name} (${sow.behindPct}% behind) → ${dm.email}`);
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
