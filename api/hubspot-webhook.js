// Vercel Serverless Function — Handles HubSpot deal stage change webhooks
// Register this URL in HubSpot: Settings → Integrations → Private Apps → Webhooks
// Subscribe to: deal.propertyChange for property: dealstage

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN;
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const HS_BASE       = 'https://api.hubapi.com';

// HubSpot product → Delivery Hub category mapping
const PRODUCT_TO_CATEGORY = {
  'MES/Logbooks':     'Logbooks',
  'MES/Batch Records':'MES',
  'CLEEN':            'CLEEN',
  'OS/Learning':      'LMS',
  'OS/Documents':     'DMS',
  'Celestara':        'AI Agents',
};

async function hsGet(path) {
  const res = await fetch(`${HS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`HubSpot GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPost(path, body, prefer = '') {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Get template tasks for a category
function getTemplateTasks(categoryName) {
  // MES template tasks (used for MES, DMS, LMS, AI Agents)
  const MES_TASKS = [
    { activities: 'Conduct Kick-off call', planned_start_offset: 0, duration: 1 },
    { activities: 'Share Access Credentials', planned_start_offset: 1, duration: 1 },
    { activities: 'Environment Setup', planned_start_offset: 2, duration: 3 },
    { activities: 'Admin Configuration', planned_start_offset: 5, duration: 5 },
    { activities: 'User Training - Phase 1', planned_start_offset: 10, duration: 5 },
    { activities: 'Data Migration', planned_start_offset: 15, duration: 10 },
    { activities: 'User Training - Phase 2', planned_start_offset: 25, duration: 5 },
    { activities: 'UAT - Round 1', planned_start_offset: 30, duration: 10 },
    { activities: 'UAT - Round 2', planned_start_offset: 40, duration: 10 },
    { activities: 'Go-Live Preparation', planned_start_offset: 50, duration: 5 },
    { activities: 'Release System', planned_start_offset: 55, duration: 1 },
  ];

  const LOGBOOKS_TASKS = [
    { activities: 'Conduct Kick-off call', planned_start_offset: 0, duration: 1 },
    { activities: 'Share Access Credentials', planned_start_offset: 1, duration: 1 },
    { activities: 'Logbook Configuration', planned_start_offset: 2, duration: 5 },
    { activities: 'User Training', planned_start_offset: 7, duration: 5 },
    { activities: 'UAT - Round 1', planned_start_offset: 12, duration: 7 },
    { activities: 'UAT - Round 2', planned_start_offset: 19, duration: 7 },
    { activities: 'Go-Live Preparation', planned_start_offset: 26, duration: 3 },
    { activities: 'Release System', planned_start_offset: 29, duration: 1 },
  ];

  const CLEEN_TASKS = [
    { activities: 'Conduct Kick-off call', planned_start_offset: 0, duration: 1 },
    { activities: 'Share Access Credentials', planned_start_offset: 1, duration: 1 },
    { activities: 'CLEEN Configuration', planned_start_offset: 2, duration: 5 },
    { activities: 'User Training', planned_start_offset: 7, duration: 5 },
    { activities: 'Go-Live Preparation', planned_start_offset: 12, duration: 3 },
    { activities: 'Release System', planned_start_offset: 15, duration: 1 },
  ];

  if (categoryName === 'Logbooks') return LOGBOOKS_TASKS;
  if (categoryName === 'CLEEN')    return CLEEN_TASKS;
  return MES_TASKS; // MES, DMS, LMS, AI Agents
}

// Add working days to a date (skip weekends)
function addWorkdays(startDate, days) {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return date;
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!HUBSPOT_TOKEN) return res.status(500).json({ error: 'HUBSPOT_API_TOKEN not set' });
  if (!SUPABASE_URL)  return res.status(500).json({ error: 'Supabase env vars not set' });

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const log = [];

    for (const event of events) {
      // Only handle deal stage changes
      if (event.subscriptionType !== 'deal.propertyChange') continue;
      if (event.propertyName !== 'dealstage') continue;

      const dealId = String(event.objectId);

      // Fetch pipeline stages to get label for new stage
      const { results: pipelines } = await hsGet('/crm/v3/pipelines/deals');
      const stageMap = {};
      for (const pipeline of (pipelines || [])) {
        for (const stage of (pipeline.stages || [])) {
          stageMap[stage.id] = stage.label;
        }
      }

      const newStageLabel = stageMap[event.propertyValue] || event.propertyValue;
      log.push(`Deal ${dealId} moved to: ${newStageLabel}`);

      // Fetch full deal details
      const deal = await hsGet(
        `/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,po_date,product,closedate,hs_object_id`
      );
      const props = deal.properties;

      // Upsert into hubspot_deals table
      await sbPost('hubspot_deals?on_conflict=hs_object_id', {
        hs_object_id:     props.hs_object_id,
        deal_name:        props.dealname   || null,
        deal_stage:       props.dealstage  || null,
        deal_stage_label: newStageLabel,
        po_date:          props.po_date    || null,
        close_date:       props.closedate  || null,
        product:          props.product    || null,
        synced_at:        new Date().toISOString(),
      }, 'resolution=merge-duplicates');

      // If moving to "Ready for Onboarding" → auto-create project + plan
      if (newStageLabel === 'Ready for Onboarding') {
        // Check if project already exists for this deal
        const existing = await sbGet(
          `projects?hubspot_deal_id=eq.${props.hs_object_id}&select=id`
        );
        if (existing?.length > 0) {
          log.push(`  → Project already exists for deal ${dealId}, skipping`);
          continue;
        }

        // Look up category ID from categories table
        const categoryName = PRODUCT_TO_CATEGORY[props.product] || 'MES';
        const categories = await sbGet(`categories?name=eq.${encodeURIComponent(categoryName)}&select=id`);
        const categoryId = categories?.[0]?.id || null;

        // Create project
        const projectName = props.dealname || `Deal ${dealId}`;
        const poDate = props.po_date || null;

        const [newProject] = await sbPost('projects?select=id', {
          name:             projectName,
          deal_stage:       newStageLabel,
          hubspot_deal_id:  props.hs_object_id,
          category_id:      categoryId,
          po_date:          poDate,
          planned_go_live:  null,
          created_at:       new Date().toISOString(),
        }, 'return=representation');

        if (!newProject?.id) {
          log.push(`  → Failed to create project for deal ${dealId}`);
          continue;
        }

        log.push(`  → Created project: ${projectName} (id: ${newProject.id})`);

        // Create plan tasks from template
        const templateTasks = getTemplateTasks(categoryName);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const planRows = templateTasks.map((t, i) => {
          const plannedStart = addWorkdays(today, t.planned_start_offset);
          const plannedEnd   = addWorkdays(new Date(plannedStart), t.duration - 1);
          return {
            project_id:    newProject.id,
            sort_order:    i + 1,
            activities:    t.activities,
            planned_start: toDateStr(plannedStart),
            planned_end:   toDateStr(plannedEnd),
            status:        'Not Started',
            duration:      t.duration,
          };
        });

        await sbPost('project_plan', planRows, 'return=minimal');
        log.push(`  → Created ${planRows.length} plan tasks for category: ${categoryName}`);
      }

      // Update deal stage on existing project if it exists
      const existingProjects = await sbGet(
        `projects?hubspot_deal_id=eq.${props.hs_object_id}&select=id`
      );
      if (existingProjects?.length > 0) {
        await sbPatch(
          `projects?hubspot_deal_id=eq.${props.hs_object_id}`,
          { deal_stage: newStageLabel }
        );
        log.push(`  → Updated deal_stage to "${newStageLabel}" on existing project`);
      }
    }

    return res.status(200).json({ message: 'Webhook processed', log });

  } catch (err) {
    console.error('hubspot-webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
