// Vercel Serverless Function — Syncs HubSpot deals into Supabase hubspot_deals table
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

async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  if (!HUBSPOT_TOKEN)  return res.status(500).json({ error: 'HUBSPOT_API_TOKEN not set' });
  if (!SUPABASE_URL)   return res.status(500).json({ error: 'Supabase env vars not set' });

  try {
    // 1. Fetch pipeline stages to build stageId → label map
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
    const properties = [
      'dealname', 'dealstage', 'po_date', 'product',
      'closedate', 'hs_object_id',
    ];

    let allDeals = [];
    let after = undefined;

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

    // 4. Upsert into Supabase hubspot_deals table
    const rows = allDeals.map(deal => {
      const p = deal.properties;
      return {
        hs_object_id:     p.hs_object_id,
        deal_name:        p.dealname       || null,
        deal_stage:       p.dealstage      || null,
        deal_stage_label: stageMap[p.dealstage] || p.dealstage || null,
        po_date:          p.po_date        || null,
        close_date:       p.closedate      || null,
        product:          p.product        || null,
        synced_at:        new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      await sbPost('hubspot_deals?on_conflict=hs_object_id', rows);
    }

    return res.status(200).json({
      message: `Synced ${rows.length} deals from HubSpot`,
      stages: stageMap,
      deals: rows.map(r => `${r.deal_name} (${r.deal_stage_label})`),
    });

  } catch (err) {
    console.error('hubspot-sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
