// Vercel Serverless Function — Daily Slack alert for stale Delivery Hub projects
// Triggered by Vercel cron at 17:30 UTC (23:00 IST) daily

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use service role key to bypass RLS in serverless context
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DM_SLACK_IDS = JSON.parse(process.env.SLACK_DM_IDS || '{}');

const CRON_SECRET = process.env.CRON_SECRET;

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase error on ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().split('T')[0];
}

function daysAgo(dateStr) {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default async function handler(req, res) {
  // Verify this is a legitimate cron call
  const authHeader = req.headers['authorization'];
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!WEBHOOK_URL) return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not set' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env vars not set' });

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

    const [projects, profiles] = await Promise.all([
      sbGet('projects?select=id,name,dm_id'),
      sbGet('profiles?select=id,email,full_name'),
    ]);

    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
    const alerts = [];
    const log = [
      `DEBUG: ${projects.length} projects fetched`,
      `DEBUG: ${profiles.length} profiles fetched`,
      `DEBUG: using key type = ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'}`,
    ];

    for (const proj of projects) {
      if (!proj.dm_id) continue;
      const dm = profileMap[proj.dm_id];
      if (!dm) continue;

      const issues = [];

      // --- Project Plan ---
      const planTasks = await sbGet(
        `project_plan?select=activities,planned_end,status,updated_at` +
        `&project_id=eq.${proj.id}` +
        `&status=not.in.(Done,Not%20Applicable,Blocked)`
      );
      const overduePlan = planTasks.filter(t => isOverdue(t.planned_end));
      if (overduePlan.length > 0) {
        const lastUpd = planTasks.map(t => t.updated_at).filter(Boolean).sort().pop();
        if (!lastUpd || lastUpd < threeDaysAgo) {
          issues.push({
            sheet: 'Project Plan',
            detail: `${overduePlan.length} overdue task(s), last updated ${daysAgo(lastUpd)} day(s) ago`,
            items: overduePlan.slice(0, 3).map(t => t.activities).filter(Boolean),
          });
        }
      }

      // --- UAT ---
      const uatItems = await sbGet(
        `uat_items?select=process_name,status,updated_at` +
        `&project_id=eq.${proj.id}` +
        `&status=not.in.(Approved,Done,Not%20Applicable)`
      );
      if (uatItems.length > 0) {
        const lastUpd = uatItems.map(t => t.updated_at).filter(Boolean).sort().pop();
        if (!lastUpd || lastUpd < threeDaysAgo) {
          issues.push({
            sheet: 'UAT Tracker',
            detail: `${uatItems.length} pending item(s), last updated ${daysAgo(lastUpd)} day(s) ago`,
            items: uatItems.slice(0, 3).map(t => t.process_name).filter(Boolean),
          });
        }
      }

      // --- Payments ---
      const payments = await sbGet(
        `payments?select=line_item,payment_status,planned_date,updated_at` +
        `&project_id=eq.${proj.id}` +
        `&payment_status=in.(Not%20Paid,Invoice%20Sent,Project%20Pending)`
      );
      const overduePayments = payments.filter(p => isOverdue(p.planned_date));
      if (overduePayments.length > 0) {
        const lastUpd = payments.map(p => p.updated_at).filter(Boolean).sort().pop();
        if (!lastUpd || lastUpd < threeDaysAgo) {
          issues.push({
            sheet: 'Payments',
            detail: `${overduePayments.length} overdue payment(s), last updated ${daysAgo(lastUpd)} day(s) ago`,
            items: overduePayments.slice(0, 3).map(p => p.line_item).filter(Boolean),
          });
        }
      }

      if (issues.length > 0) {
        alerts.push({ proj, dm, issues });
        log.push(`⚠ ${proj.name} — ${issues.map(i => i.sheet).join(', ')}`);
      } else {
        log.push(`✓ ${proj.name} — clean`);
      }
    }

    if (alerts.length === 0) {
      return res.status(200).json({ message: '✅ No stale projects found today.', log });
    }

    const sent = [];

    for (const { proj, dm, issues } of alerts) {
      const slackId = DM_SLACK_IDS[dm.email];
      const mention = slackId ? `<@${slackId}>` : dm.full_name;

      const blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `⚠️ Project Update Reminder`, emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hi ${mention}! 👋 Your project *${proj.name}* has items that need attention:`,
          },
        },
        { type: 'divider' },
        ...issues.map(issue => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*📋 ${issue.sheet}* — ${issue.detail}`,
              ...issue.items.map(i => `• ${i}`),
              issue.items.length === 0 ? '' : '',
            ].filter(Boolean).join('\n'),
          },
        })),
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Delivery Hub · Auto-check at 5:30 PM daily · <https://delivery-hub-v2.vercel.app|Open App>` }],
        },
      ];

      const slackRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Project update reminder: ${proj.name}`, blocks }),
      });

      if (slackRes.ok) {
        sent.push(`${proj.name} → ${dm.email}`);
      } else {
        log.push(`❌ Slack post failed for ${proj.name}: ${slackRes.status}`);
      }
    }

    return res.status(200).json({ message: `Sent ${sent.length} alert(s)`, sent, log });
  } catch (err) {
    console.error('slack-alert error:', err);
    return res.status(500).json({ error: err.message });
  }
}
