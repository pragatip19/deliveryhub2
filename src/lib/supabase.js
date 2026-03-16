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
export async function getProjects(userId, role) {
  let query = supabase.from('projects').select(`
    *,
    categories ( name ),
    profiles!dm_id ( full_name, email )
  `).order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    category_name: p.categories?.name || '',
    dm_name: p.profiles?.full_name || '',
  }));
}

export async function getMyProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`*, categories(name), profiles!dm_id(full_name, email)`)
    .eq('dm_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    category_name: p.categories?.name || '',
    dm_name: p.profiles?.full_name || '',
  }));
}

export async function getProject(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`*, categories(name), profiles!dm_id(full_name, email)`)
    .eq('id', projectId)
    .single();
  if (error) throw error;
  return { ...data, category_name: data.categories?.name, dm_name: data.profiles?.full_name };
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

export async function upsertMilestone(milestone) {
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

export async function upsertSOWItem(item) {
  const { data, error } = await supabase.from('sow_items').upsert(item).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSOWItem(id) {
  const { error } = await supabase.from('sow_items').delete().eq('id', id);
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

export async function upsertSOWDropdownOption(option) {
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

export async function upsertPayment(payment) {
  const { data, error } = await supabase.from('payments').upsert(payment).select().single();
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
    .select(`*, projects(name, category_id, dm_id, planned_go_live, profiles!dm_id(full_name), categories(name))`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    project_name: p.projects?.name || '',
    category_name: p.projects?.categories?.name || '',
    dm_name: p.projects?.profiles?.full_name || '',
    go_live_date: p.projects?.planned_go_live,
    project_link: `/project/${p.project_id}`,
  }));
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

export async function upsertUATItem(item) {
  const { data, error } = await supabase.from('uat_items').upsert(item).select().single();
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
  const { data, error } = await supabase.from('raid_items').upsert(item).select().single();
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

export async function upsertFeedbackItem(item) {
  const { data, error } = await supabase.from('feedback_items').upsert(item).select().single();
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
