// Vercel Serverless Function — Pushes Delivery Hub values back to HubSpot daily
// Cron: 30 10 * * * (4:00 PM IST = 10:30 UTC)

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const HS_BASE       = 'https://api.hubapi.com';

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function hsPatch(dealId, properties) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`HubSpot PATCH deal ${dealId}: ${res.status} ${await res.text()}`);
  return res.json();
}

function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }

function networkdays(start, end) {
  let count = 0;
  const cur = new Date(start); cur.setHours(0,0,0,0);
  const fin = new Date(end);   fin.setHours(0,0,0,0);
  if (cur > fin) return 0;
  while (cur <= fin) {
    if (!isWeekend(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default async function handler(req, res) {
  if (!HUBSPOT_TOKEN) return res.status(500).json({ error: 'HUBSPOT_API_TOKEN not set' });
  if (!SUPABASE_URL)  return res.status(500).json({ error: 'Supabase env vars not set' });

  try {
    // Fetch all projects linked to a HubSpot deal
    const projects = await sbGet(
      `projects?hubspot_deal_id=not.is.null&select=id,name,hubspot_deal_id,` +
      `projected_go_live,kickoff_date,sow_current_pct,sow_expected_pct,` +
      `target_sow_completion_days,sow_completion_date,deal_stage`
    );

    const log  = [`${projects.length} linked projects found`];
    const sent = [];

    for (const proj of projects) {
      if (!proj.hubspot_deal_id) continue;

      // Calculate actual onboarding days (kickoff → projected go-live)
      let actualOnboardingDays = null;
      if (proj.kickoff_date && proj.projected_go_live) {
        actualOnboardingDays = networkdays(
          new Date(proj.kickoff_date),
          new Date(proj.projected_go_live)
        );
      }

      // Build HubSpot properties to update
      const properties = {};

      if (proj.projected_go_live)
        properties['go_live_date'] = proj.projected_go_live;

      if (actualOnboardingDays !== null)
        properties['actual_onboarding_days'] = String(actualOnboardingDays);

      if (proj.sow_expected_pct !== null && proj.sow_expected_pct !== undefined)
        properties['expected_project_completion____'] = String(proj.sow_expected_pct);

      if (proj.sow_current_pct !== null && proj.sow_current_pct !== undefined)
        properties['project_completion____'] = String(proj.sow_current_pct);

      if (proj.sow_completion_date)
        properties['implementation_closed_date'] = proj.sow_completion_date;

      // Target SOW days: if sow_completion_date is set, calculate from projected go-live
      if (proj.sow_completion_date && proj.projected_go_live) {
        const targetDays = networkdays(
          new Date(proj.projected_go_live),
          new Date(proj.sow_completion_date)
        );
        properties['target_onboarding_days'] = String(targetDays);
      } else if (proj.target_sow_completion_days) {
        properties['target_onboarding_days'] = String(proj.target_sow_completion_days);
      }

      if (Object.keys(properties).length === 0) {
        log.push(`${proj.name}: nothing to push`);
        continue;
      }

      try {
        await hsPatch(proj.hubspot_deal_id, properties);
        sent.push(proj.name);
        log.push(`${proj.name}: pushed ${Object.keys(properties).join(', ')}`);
      } catch (err) {
        log.push(`${proj.name}: ❌ ${err.message}`);
      }
    }

    return res.status(200).json({
      message: `Pushed ${sent.length} project(s) to HubSpot`,
      sent,
      log,
    });

  } catch (err) {
    console.error('hubspot-pushback error:', err);
    return res.status(500).json({ error: err.message });
  }
}
