// Vercel Serverless Function — Syncs HubSpot deals into Supabase hubspot_deals table
// Also auto-creates projects for deals in "Ready for Onboarding" with no linked project
// Cron: 0 */2 * * * (every 2 hours)

const HUBSPOT_TOKEN  = process.env.HUBSPOT_API_TOKEN;
const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const HS_BASE = 'https://api.hubapi.com';

const TARGET_STAGE_LABELS = [
  'Closed Won',
  'Ready for Onboarding',
  'Under Onboarding',
  'Live Under Scaleup',
];

const PRODUCT_TO_CATEGORY = {
  'MES/Logbooks':      'Logbooks',
  'MES/Batch Records': 'MES',
  'CLEEN':             'CLEEN',
  'OS/Learning':       'LMS',
  'OS/Documents':      'DMS',
  'Celestara':         'AI Agents',
};

// ── HubSpot helpers ──────────────────────────────────────────────────────────
async function hsGet(path) {
  const res = await fetch(`${HS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`HubSpot GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function hsPost(path, body) {
  const res = await fetch(`${HS_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HubSpot POST ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Supabase helpers ─────────────────────────────────────────────────────────
async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPost(path, body, prefer = 'resolution=merge-duplicates') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
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

// ── Template helpers ─────────────────────────────────────────────────────────
function getTemplateTasks(categoryName) {
  const MES_TASKS = [
    { activities: 'Conduct Kick-off call',    planned_start_offset: 0,  duration: 1 },
    { activities: 'Share Access Credentials', planned_start_offset: 1,  duration: 1 },
    { activities: 'Environment Setup',        planned_start_offset: 2,  duration: 3 },
    { activities: 'Admin Configuration',      planned_start_offset: 5,  duration: 5 },
    { activities: 'User Training - Phase 1',  planned_start_offset: 10, duration: 5 },
    { activities: 'Data Migration',           planned_start_offset: 15, duration: 10 },
    { activities: 'User Training - Phase 2',  planned_start_offset: 25, duration: 5 },
    { activities: 'UAT - Round 1',            planned_start_offset: 30, duration: 10 },
    { activities: 'UAT - Round 2',            planned_start_offset: 40, duration: 10 },
    { activities: 'Go-Live Preparation',      planned_start_offset: 50, duration: 5 },
    { activities: 'Release System',           planned_start_offset: 55, duration: 1 },
  ];
  const LOGBOOKS_TASKS = [
    { activities: 'Conduct Kick-off call',    planned_start_offset: 0,  duration: 1 },
    { activities: 'Share Access Credentials', planned_start_offset: 1,  duration: 1 },
    { activities: 'Logbook Configuration',   planned_start_offset: 2,  duration: 5 },
    { activities: 'User Training',           planned_start_offset: 7,  duration: 5 },
    { activities: 'UAT - Round 1',           planned_start_offset: 12, duration: 7 },
    { activities: 'UAT - Round 2',           planned_start_offset: 19, duration: 7 },
    { activities: 'Go-Live Preparation',     planned_start_offset: 26, duration: 3 },
    { activities: 'Release System',          planned_start_offset: 29, duration: 1 },
  ];
  const CLEEN_TASKS = [
    { activities: 'Conduct Kick-off call',    planned_start_offset: 0,  duration: 1 },
    { activities: 'Share Access Credentials', planned_start_offset: 1,  duration: 1 },
    { activities: 'CLEEN Configuration',     planned_start_offset: 2,  duration: 5 },
    { activities: 'User Training',           planned_start_offset: 7,  duration: 5 },
    { activities: 'Go-Live Preparation',     planned_start_offset: 12, duration: 3 },
    { activities: 'Release System',          planned_start_offset: 15, duration: 1 },
  ];
  if (categoryName === 'Logbooks') return LOGBOOKS_TASKS;
  if (categoryName === 'CLEEN')    return CLEEN_TASKS;
  return MES_TASKS;
}

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

// ── Auto-create project + plan for a "Ready for Onboarding" deal ─────────────
async function maybeCreateProject(deal, stageLabel, log) {
  const props = deal.properties;
  const hsId  = props.hs_object_id;

  // Check if project already linked
  const existing = await sbGet(`projects?hubspot_deal_id=eq.${hsId}&select=id`);
  if (existing?.length > 0) {
    log.push(`  Deal ${hsId}: project already exists, skipping auto-create`);
    return;
  }

  const categoryName = PRODUCT_TO_CATEGORY[props.product] || 'MES';
  const categories   = await sbGet(`categories?name=eq.${encodeURIComponent(categoryName)}&select=id`);
  const categoryId   = categories?.[0]?.id || null;

  // Match delivery manager name → profiles.id
  let dmId = null;
  const dmName = props.delivery_manager?.trim();
  if (dmName) {
    const profiles = await sbGet(
      `profiles?full_name=ilike.${encodeURIComponent(dmName)}&select=id&limit=1`
    );
    dmId = profiles?.[0]?.id || null;
    if (!dmId) log.push(`  Deal ${hsId}: delivery_manager "${dmName}" not found in profiles`);
  }

  const projectName = props.dealname || `Deal ${hsId}`;

  const [newProject] = await sbPost('projects?select=id', {
    name:            projectName,
    deal_stage:      stageLabel,
    hubspot_deal_id: hsId,
    category_id:     categoryId,
    po_date:         props.po_date   || null,
    planned_go_live: null,
    dm_id:           dmId,
    created_at:      new Date().toISOString(),
  }, 'return=representation');

  if (!newProject?.id) {
    log.push(`  Deal ${hsId}: failed to create project`);
    return;
  }

  log.push(`  Deal ${hsId}: created project "${projectName}" (id: ${newProject.id}, dm_id: ${dmId || 'unmatched'})`);

  // Create plan tasks
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
  log.push(`  Deal ${hsId}: created ${planRows.length} plan tasks (${categoryName})`);
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!HUBSPOT_TOKEN) return res.status(500).json({ error: 'HUBSPOT_API_TOKEN not set' });
  if (!SUPABASE_URL)  return res.status(500).json({ error: 'Supabase env vars not set' });

  const log = [];

  try {
    // 1. Fetch pipeline stages → stageId → label map
    const { results: pipelines } = await hsGet('/crm/v3/pipelines/deals');
    const stageMap = {};
    for (const pipeline of (pipelines || [])) {
      for (const stage of (pipeline.stages || [])) {
        stageMap[stage.id] = stage.label;
      }
    }

    // 2. Find stage IDs for our target labels
    const targetStageIds = Object.entries(stageMap)
      .filter(([, label]) => TARGET_STAGE_LABELS.includes(label))
      .map(([id]) => id);

    if (targetStageIds.length === 0) {
      return res.status(200).json({ message: 'No matching deal stages found', stageMap });
    }

    // 3. Search HubSpot for deals in those stages
    const properties = ['dealname', 'dealstage', 'po_date', 'product', 'closedate', 'hs_object_id', 'delivery_manager'];
    let allDeals = [];
    let after;

    do {
      const body = {
        filterGroups: targetStageIds.map(id => ({
          filters: [{ propertyName: 'dealstage', operator: 'EQ', value: id }],
        })),
        properties,
        limit: 100,
        ...(after ? { after } : {}),
      };
      const { results, paging } = await hsPost('/crm/v3/objects/deals/search', body);
      allDeals = allDeals.concat(results || []);
      after = paging?.next?.after;
    } while (after);

    // 4. Upsert all deals into Supabase hubspot_deals table
    const rows = allDeals.map(deal => {
      const p = deal.properties;
      return {
        hs_object_id:       p.hs_object_id,
        deal_name:          p.dealname          || null,
        deal_stage:         p.dealstage         || null,
        deal_stage_label:   stageMap[p.dealstage] || p.dealstage || null,
        po_date:            p.po_date           || null,
        close_date:         p.closedate         || null,
        product:            p.product           || null,
        delivery_manager:   p.delivery_manager  || null,
        synced_at:          new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      await sbPost('hubspot_deals?on_conflict=hs_object_id', rows);
    }
    log.push(`Synced ${rows.length} deals into hubspot_deals`);

    // 5. Update deal_stage on any existing linked projects
    for (const deal of allDeals) {
      const p = deal.properties;
      const label = stageMap[p.dealstage] || p.dealstage;
      const linked = await sbGet(`projects?hubspot_deal_id=eq.${p.hs_object_id}&select=id,deal_stage`);
      if (linked?.length > 0 && linked[0].deal_stage !== label) {
        await sbPatch(`projects?hubspot_deal_id=eq.${p.hs_object_id}`, { deal_stage: label });
        log.push(`Updated deal_stage → "${label}" on project linked to deal ${p.hs_object_id}`);
      }
    }

    // 6. Auto-create projects for "Ready for Onboarding" deals with no linked project
    const readyDeals = allDeals.filter(d => stageMap[d.properties.dealstage] === 'Ready for Onboarding');
    log.push(`Found ${readyDeals.length} deals in "Ready for Onboarding"`);

    for (const deal of readyDeals) {
      await maybeCreateProject(deal, 'Ready for Onboarding', log);
    }

    return res.status(200).json({
      message: `Sync complete`,
      log,
      total_deals: rows.length,
      ready_for_onboarding: readyDeals.length,
    });

  } catch (err) {
    console.error('hubspot-sync error:', err);
    return res.status(500).json({ error: err.message, log });
  }
}
