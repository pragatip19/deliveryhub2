// supabase.js — All Supabase DB helpers

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// AUTH
// ============================================================
export async function signUp(email, fullName, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: 'dm' },
      emailRedirectTo: `${window.location.origin}/email-confirmed`,
    },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ============================================================
// PROFILES
// ============================================================
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data || [];
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// CATEGORIES
// ============================================================
export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data || [];
}

// ============================================================
// PROJECTS
// ============================================================
async function enrichProjects(projects) {
  if (!projects || projects.length === 0) return [];

  // Fetch categories
  const { data: cats } = await supabase.from('categories').select('id, name');
  const catMap = {};
  (cats || []).forEach(c => { catMap[c.id] = c.name; });

  // Fetch DM profiles
  const dmIds = [...new Set(projects.map(p => p.dm_id).filter(Boolean))];
  const profileMap = {};
  if (dmIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', dmIds);
    (profiles || []).forEach(pr => { profileMap[pr.id] = pr; });
  }

  return projects.map(p => ({
    ...p,
    category_name: catMap[p.category_id] || '',
    dm_name: profileMap[p.dm_id]?.full_name || '',
    dm_email: profileMap[p.dm_id]?.email || '',
  }));
}

export async function getProjects(userId, role) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichProjects(data || []);
}

export async function getMyProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('dm_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichProjects(data || []);
}

export async function getProject(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error) throw error;
  const enriched = await enrichProjects([data]);
  return enriched[0];
}

// Alias for getProject
export const getProjectById = getProject;

export async function createProject(project) {
  const { data, error } = await supabase.from('projects').insert(project).select().single();
  if (error) throw error;
  return data;
}

export async function updateProject(projectId, updates) {
  const { data, error } = await supabase.from('projects').update(updates).eq('id', projectId).select().single();
  if (error) throw error;
  // Sync deal record
  syncDeal(projectId).catch(console.warn);
  return data;
}

export async function deleteProject(projectId) {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

// Deep-copy a project and all its child data (milestones, plan, SOW, payments, people, UAT, RAID, feedback)
export async function duplicateProject(sourceProjectId, newName) {
  // 1. Fetch source project
  const { data: src, error: srcErr } = await supabase
    .from('projects').select('*').eq('id', sourceProjectId).single();
  if (srcErr) throw srcErr;

  // 2. Create new project (strip identity / date fields that should be fresh)
  const { id: _id, created_at, updated_at, kickoff_date, projected_go_live,
          planned_go_live, ...projectFields } = src;
  const newProject = await createProject({ ...projectFields, name: newName });
  const newId = newProject.id;

  // 3. Helper — re-ID an array of rows and point them at the new project
  function reId(rows, extraMap = {}) {
    return rows.map(r => {
      const { id, project_id, created_at, updated_at, ...rest } = r;
      return { id: crypto.randomUUID(), project_id: newId, ...rest, ...extraMap(r) };
    });
  }

  // 4. Fetch all child data in parallel
  const [milestones, tasks, sowItems, sowOpts, payments, people, uatItems, raidItems, feedbackItems] =
    await Promise.all([
      supabase.from('milestones').select('*').eq('project_id', sourceProjectId).order('sort_order'),
      supabase.from('project_plan').select('*').eq('project_id', sourceProjectId).order('sort_order'),
      supabase.from('sow_items').select('*').eq('project_id', sourceProjectId).order('sort_order'),
      supabase.from('sow_dropdown_options').select('*').eq('project_id', sourceProjectId),
      supabase.from('payments').select('*').eq('project_id', sourceProjectId).order('sort_order'),
      supabase.from('people').select('*').eq('project_id', sourceProjectId),
      supabase.from('uat_items').select('*').eq('project_id', sourceProjectId).order('sort_order'),
      supabase.from('raid_items').select('*').eq('project_id', sourceProjectId).order('sort_order'),
      supabase.from('feedback_items').select('*').eq('project_id', sourceProjectId).order('sort_order'),
    ]);

  // 5. Build old→new milestone ID map (plan tasks reference milestones by UUID)
  const msRows   = milestones.data || [];
  const msIdMap  = {};   // oldId → newId
  const newMsRows = msRows.map(r => {
    const newMsId = crypto.randomUUID();
    msIdMap[r.id] = newMsId;
    const { id, project_id, created_at, updated_at, ...rest } = r;
    return { id: newMsId, project_id: newId, ...rest };
  });

  // 6. Copy tasks — remap milestone FK
  const taskRows = (tasks.data || []).map(r => {
    const { id, project_id, created_at, updated_at, ...rest } = r;
    return {
      id: crypto.randomUUID(),
      project_id: newId,
      ...rest,
      // remap milestone field: if it's a known old milestone UUID, replace with new UUID
      milestone: msIdMap[rest.milestone] ?? rest.milestone,
    };
  });

  // 7. Payments — strip 'milestone' text field that doesn't exist in DB
  const paymentRows = (payments.data || []).map(r => {
    const { id, project_id, created_at, updated_at, milestone, ...rest } = r;
    return { id: crypto.randomUUID(), project_id: newId, ...rest };
  });

  // 8. Simple re-ID for the rest
  const simpleReId = (rows) => rows.map(r => {
    const { id, project_id, created_at, updated_at, ...rest } = r;
    return { id: crypto.randomUUID(), project_id: newId, ...rest };
  });

  // 9. Insert everything in parallel (skip empty arrays)
  await Promise.all([
    newMsRows.length    ? supabase.from('milestones').insert(newMsRows) : null,
    taskRows.length     ? supabase.from('project_plan').insert(taskRows) : null,
    (sowItems.data || []).length ? supabase.from('sow_items').insert(simpleReId(sowItems.data)) : null,
    (sowOpts.data || []).length  ? supabase.from('sow_dropdown_options').insert(
        (sowOpts.data).map(r => { const { id, project_id, created_at, updated_at, ...rest } = r; return { project_id: newId, ...rest }; })
      ) : null,
    paymentRows.length  ? supabase.from('payments').insert(paymentRows) : null,
    (people.data || []).length   ? supabase.from('people').insert(simpleReId(people.data)) : null,
    (uatItems.data || []).length ? supabase.from('uat_items').insert(simpleReId(uatItems.data)) : null,
    (raidItems.data || []).length ? supabase.from('raid_items').insert(simpleReId(raidItems.data)) : null,
    (feedbackItems.data || []).length ? supabase.from('feedback_items').insert(simpleReId(feedbackItems.data)) : null,
  ].filter(Boolean));

  return newProject;
}

// ============================================================
// PROJECT ACCESS
// ============================================================
export async function getProjectAccess(projectId) {
  const { data, error } = await supabase
    .from('project_access')
    .select('*, profiles(full_name, email, role)')
    .eq('project_id', projectId);
  if (error) throw error;
  return data || [];
}

export async function upsertProjectAccess(projectId, userId, canEdit) {
  const { error } = await supabase.from('project_access').upsert({
    project_id: projectId, user_id: userId, can_edit: canEdit
  }, { onConflict: 'project_id,user_id' });
  if (error) throw error;
}

// ============================================================
// MILESTONES
// ============================================================
export async function getMilestones(projectId) {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Accepts both: upsertMilestone(obj) or upsertMilestone(projectId, id, updates)
export async function upsertMilestone(projectIdOrObj, id, updates) {
  let milestone;
  if (typeof projectIdOrObj === 'object' && projectIdOrObj !== null) {
    milestone = projectIdOrObj;
  } else {
    milestone = { project_id: projectIdOrObj, ...updates };
    if (id) milestone.id = id;
  }
  const { data, error } = await supabase.from('milestones').upsert(milestone).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMilestone(id) {
  const { error } = await supabase.from('milestones').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkUpsertMilestones(milestones) {
  if (!milestones.length) return [];
  const { data, error } = await supabase.from('milestones').upsert(milestones).select();
  if (error) throw error;
  return data || [];
}

// Recalculate milestone start/end from project plan tasks
export async function recalcMilestoneDates(projectId) {
  const tasks = await getPlanTasks(projectId);
  const milestones = await getMilestones(projectId);

  const updates = milestones.map(m => {
    const mTasks = tasks.filter(t => t.milestone === m.name);
    if (!mTasks.length) return m;
    const starts = mTasks.map(t => t.planned_start).filter(Boolean).sort();
    const ends = mTasks.map(t => t.planned_end).filter(Boolean).sort();
    return {
      ...m,
      start_date: starts[0] || m.start_date,
      end_date: ends[ends.length - 1] || m.end_date,
    };
  });

  await bulkUpsertMilestones(updates);
  return updates;
}

// ============================================================
// PROJECT PLAN
// ============================================================
export async function getPlanTasks(projectId) {
  const { data, error } = await supabase
    .from('project_plan')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertPlanTask(task) {
  const { data, error } = await supabase.from('project_plan').upsert(task).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlanTask(id) {
  const { error } = await supabase.from('project_plan').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkUpsertPlanTasks(tasks) {
  if (!tasks.length) return [];
  const { data, error } = await supabase.from('project_plan').upsert(tasks).select();
  if (error) throw error;
  return data || [];
}

export async function clearPlanTasks(projectId) {
  const { error } = await supabase
    .from('project_plan')
    .delete()
    .eq('project_id', projectId);
  if (error) throw error;
}

// ============================================================
// SOW
// ============================================================
export async function getSOWItems(projectId) {
  const { data, error } = await supabase
    .from('sow_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Accepts both: upsertSOWItem(obj) or upsertSOWItem(projectId, itemId, updates)
export async function upsertSOWItem(projectIdOrObj, itemId, updates) {
  // 1-arg form: upsertSOWItem(obj) — used for new row inserts (handleAddRow)
  if (typeof projectIdOrObj === 'object' && projectIdOrObj !== null) {
    const { data, error } = await supabase.from('sow_items').upsert(projectIdOrObj).select().single();
    if (error) throw error;
    return data;
  }
  // 3-arg form: upsertSOWItem(projectId, itemId, updates) — auto-save of existing rows
  // Use UPDATE (not upsert) to avoid partial-payload constraint issues on existing rows
  const { data, error } = await supabase
    .from('sow_items')
    .update(updates)
    .eq('id', itemId)
    .eq('project_id', projectIdOrObj)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSOWItem(id) {
  const { error } = await supabase.from('sow_items').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllSOWItems(projectId) {
  const { error } = await supabase.from('sow_items').delete().eq('project_id', projectId);
  if (error) throw error;
}

export async function bulkUpsertSOWItems(items) {
  if (!items.length) return [];
  const { data, error } = await supabase.from('sow_items').upsert(items).select();
  if (error) throw error;
  return data || [];
}

export async function getSOWDropdownOptions(projectId) {
  const { data, error } = await supabase
    .from('sow_dropdown_options')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data || [];
}

// Accepts both: upsertSOWDropdownOption(obj) or upsertSOWDropdownOption(projectId, section, value)
export async function upsertSOWDropdownOption(projectIdOrObj, section, value) {
  let option;
  if (typeof projectIdOrObj === 'object' && projectIdOrObj !== null) {
    option = projectIdOrObj;
  } else {
    option = { project_id: projectIdOrObj, section, work_item: value };
  }
  const { data, error } = await supabase.from('sow_dropdown_options').upsert(option, {
    onConflict: 'project_id,section,work_item'
  }).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// PAYMENTS
// ============================================================
export async function getPayments(projectId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Accepts both: upsertPayment(obj) or upsertPayment(projectId, item)
export async function upsertPayment(projectIdOrObj, item) {
  let payment;
  if (typeof projectIdOrObj === 'object' && projectIdOrObj !== null) {
    payment = projectIdOrObj;
  } else {
    payment = { ...item, project_id: projectIdOrObj };
  }
  // Strip 'milestone' — that column doesn't exist in the payments DB table (PGRST204)
  const { milestone: _milestone, ...paymentToSave } = payment;
  const { data, error } = await supabase.from('payments').upsert(paymentToSave).select().single();
  if (error) throw error;
  return data;
}

export async function deletePayment(id) {
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkUpsertPayments(payments) {
  if (!payments.length) return [];
  const { data, error } = await supabase.from('payments').upsert(payments).select();
  if (error) throw error;
  return data || [];
}

// Get all payments across all projects (for Pending Revenue)
export async function getAllPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const payments = data || [];
  if (!payments.length) return [];

  // Fetch projects
  const projectIds = [...new Set(payments.map(p => p.project_id).filter(Boolean))];
  const { data: projects } = await supabase.from('projects').select('*').in('id', projectIds);
  const projectMap = {};
  (projects || []).forEach(pr => { projectMap[pr.id] = pr; });

  // Fetch categories
  const { data: cats } = await supabase.from('categories').select('id, name');
  const catMap = {};
  (cats || []).forEach(c => { catMap[c.id] = c.name; });

  // Fetch DM profiles
  const dmIds = [...new Set((projects || []).map(p => p.dm_id).filter(Boolean))];
  const profileMap = {};
  if (dmIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', dmIds);
    (profiles || []).forEach(pr => { profileMap[pr.id] = pr; });
  }

  return payments.map(p => {
    const proj = projectMap[p.project_id] || {};
    return {
      ...p,
      project_name: proj.name || '',
      category_name: catMap[proj.category_id] || '',
      dm_name: profileMap[proj.dm_id]?.full_name || '',
      go_live_date: proj.planned_go_live || '',
      project_link: `/project/${p.project_id}`,
    };
  });
}

// ============================================================
// PEOPLE
// ============================================================
export async function getPeople(projectId) {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('project_id', projectId)
    .order('team').order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertPerson(person) {
  const { data, error } = await supabase.from('people').upsert(person).select().single();
  if (error) throw error;
  return data;
}

export async function deletePerson(id) {
  const { error } = await supabase.from('people').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// UAT
// ============================================================
export async function getUATItems(projectId) {
  const { data, error } = await supabase.from('uat_items').select('*').eq('project_id', projectId).order('sort_order');
  if (error) throw error;
  return data || [];
}

// Accepts both: upsertUATItem(obj) or upsertUATItem(projectId, item)
export async function upsertUATItem(projectIdOrObj, item) {
  let uatItem;
  if (typeof projectIdOrObj === 'object' && projectIdOrObj !== null) {
    uatItem = projectIdOrObj;
  } else {
    uatItem = { ...item, project_id: projectIdOrObj };
  }
  // Strip columns that don't exist in the uat_items DB table (PGRST204)
  const { approver: _a, uat_approver_id: _uid, ...uatToSave } = uatItem;
  const { data, error } = await supabase.from('uat_items').upsert(uatToSave).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUATItem(id) {
  const { error } = await supabase.from('uat_items').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// RAID
// ============================================================
export async function getRaidItems(projectId, type) {
  let query = supabase.from('raid_items').select('*').eq('project_id', projectId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertRaidItem(item) {
  // Strip 'description' — may not exist in the raid_items DB schema (PGRST204)
  // Convert empty-string date fields to null (PostgreSQL rejects "" for date columns — 22007)
  const { description: _desc, due_date, ...rest } = item;
  const raidItem = { ...rest, due_date: due_date || null };
  const { data, error } = await supabase.from('raid_items').upsert(raidItem).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRaidItem(id) {
  const { error } = await supabase.from('raid_items').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// FEEDBACK
// ============================================================
export async function getFeedbackItems(projectId) {
  const { data, error } = await supabase.from('feedback_items').select('*').eq('project_id', projectId).order('sort_order');
  if (error) throw error;
  return data || [];
}

// Accepts both: upsertFeedbackItem(obj) or upsertFeedbackItem(projectId, item)
export async function upsertFeedbackItem(projectIdOrObj, item) {
  let feedbackItem;
  if (typeof projectIdOrObj === 'object' && projectIdOrObj !== null) {
    feedbackItem = projectIdOrObj;
  } else {
    feedbackItem = { ...item, project_id: projectIdOrObj };
  }
  const { data, error } = await supabase.from('feedback_items').upsert(feedbackItem).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFeedbackItem(id) {
  const { error } = await supabase.from('feedback_items').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function getDocuments(projectId) {
  const { data, error } = await supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertDocument(doc) {
  const { data, error } = await supabase.from('documents').insert(doc).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(id) {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DEALS
// ============================================================
export async function getDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('*, projects(id, name, category_id, categories(name))')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertDeal(deal) {
  const { data, error } = await supabase.from('deals').upsert(deal).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDeal(id) {
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) throw error;
}

// Sync deal from project — calls DB function
export async function syncDeal(projectId) {
  const { error } = await supabase.rpc('sync_deal_from_project', { project_uuid: projectId });
  if (error) console.warn('Deal sync error:', error);
}

// ============================================================
// PENDING REVENUE CUSTOM COLUMNS
// ============================================================
export async function getPendingRevenueColumns() {
  const { data, error } = await supabase.from('pending_revenue_columns').select('*').order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertPendingRevenueColumn(col) {
  const { data, error } = await supabase.from('pending_revenue_columns').upsert(col).select().single();
  if (error) throw error;
  return data;
}

export async function deletePendingRevenueColumn(id) {
  const { error } = await supabase.from('pending_revenue_columns').delete().eq('id', id);
  if (error) throw error;
}

export async function getPendingRevenueCells(paymentIds) {
  if (!paymentIds.length) return [];
  const { data, error } = await supabase
    .from('pending_revenue_cells')
    .select('*')
    .in('payment_id', paymentIds);
  if (error) throw error;
  return data || [];
}

export async function upsertPendingRevenueCell(cell) {
  const { data, error } = await supabase.from('pending_revenue_cells').upsert(cell, {
    onConflict: 'payment_id,column_key'
  }).select().single();
  if (error) throw error;
  return data;
}

// ── DM Action Items ───────────────────────────────────────────────────────────

export async function getDmActions(projectId) {
  const { data, error } = await supabase
    .from('dm_actions')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertDmAction(action) {
  // Only send known DB columns — strips any camelCase keys from local state
  const row = {
    ...(action.id         ? { id: action.id }                 : {}),
    project_id: action.project_id,
    text:       action.text       ?? '',
    status:     action.status     ?? 'Not Started',
    by_when:    action.by_when    ?? action.byWhen ?? null,
    impact:     action.impact     ?? '',
    sort_order: action.sort_order ?? 0,
  };
  const { data, error } = await supabase
    .from('dm_actions')
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDmAction(id) {
  const { error } = await supabase.from('dm_actions').delete().eq('id', id);
  if (error) throw error;
}
