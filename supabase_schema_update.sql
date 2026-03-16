-- ============================================================
-- DeliveryHub v2 — Full Schema (run this in Supabase SQL editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
do $$ begin
  create type user_role as enum ('admin', 'dm', 'leadership');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('Not Started','In Progress','Done','Blocked','Not Applicable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status_type as enum ('Not Paid','Invoice Sent','Project Pending','Paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_status_type as enum ('Ready for Onboarding','Under Onboarding','Live-Under Scaleup');
exception when duplicate_object then null; end $$;

-- ============================================================
-- PROFILES (users)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role user_role not null default 'dm',
  created_at timestamptz default now()
);

-- Migrate old pm role to dm (safe to run multiple times)
update profiles set role = 'dm' where role::text = 'pm';

-- ============================================================
-- CATEGORIES (MES, Logbooks, CLEEN, DMS, AI Investigator, LMS, AI Agents)
-- ============================================================
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

insert into categories (name) values
  ('MES'), ('Logbooks'), ('CLEEN'), ('DMS'), ('AI Investigator'), ('LMS'), ('AI Agents')
on conflict (name) do nothing;

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid references categories(id),
  dm_id uuid references profiles(id),        -- Delivery Manager (was pm_id)
  record_id text,                              -- HubSpot / CRM deal ID
  deal_status deal_status_type default 'Under Onboarding',
  po_date date,
  kickoff_date date,                           -- auto-pulled from "Conduct Kick-off call" actual_start
  planned_go_live date,                        -- kickoff_date + target_onboarding_days (workdays)
  projected_go_live date,                      -- planned_end of "Release System" task
  target_onboarding_days int,                  -- 72 MES, 60 Logbooks, 30 CLEEN; others manual
  actual_onboarding_days int,                  -- networkdays(kickoff, projected_go_live)
  context text,
  critical_next_actions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rename dm column if old pm_id exists
do $$ begin
  alter table projects rename column pm_id to dm_id;
exception when undefined_column then null; end $$;

-- ============================================================
-- PROJECT ACCESS (which users can view/edit which projects)
-- ============================================================
create table if not exists project_access (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  can_edit boolean default false,
  unique(project_id, user_id)
);

-- ============================================================
-- MILESTONES MASTER (per project — DM manages this list)
-- ============================================================
create table if not exists milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  status task_status default 'Not Started',
  sort_order int default 0,
  -- start/end auto-calculated from project_plan tasks
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- ============================================================
-- PROJECT PLAN TASKS
-- ============================================================
create table if not exists project_plan (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  milestone text,                        -- milestone name (FK by name to milestones)
  activities text not null,
  tools text,
  owner text,
  status task_status default 'Not Started',
  duration int default 1,
  baseline_planned_start date,           -- set once when planned_start first calculated
  baseline_planned_end date,             -- set once when planned_end first calculated
  baseline_locked boolean default false, -- true after first set
  planned_start date,
  planned_end date,
  planned_start_locked boolean default false, -- true after status → In Progress
  actual_start date,
  current_end date,
  dependency text,                       -- activity name of predecessor
  deviation text,
  deviation_details text,
  delay_on_track text,
  no_of_days_delay int default 0,
  planned_start_vs_baseline int default 0,
  learnings_from_delay text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- SOW ITEMS
-- ============================================================
create table if not exists sow_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  section text not null,
  work_item text,
  specification text,
  notes text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- SOW DROPDOWN OPTIONS (per section, customizable)
-- ============================================================
create table if not exists sow_dropdown_options (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  section text not null,
  work_item text not null,
  options jsonb default '[]',             -- array of string options
  created_at timestamptz default now(),
  unique(project_id, section, work_item)
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  line_item text,
  milestone_name text,                   -- payment milestone name
  type text,                             -- Annual Subscription / One Time Services
  amount numeric(12,2),
  currency text default 'USD',
  milestone_status task_status default 'Not Started',
  planned_milestone_completion_date date, -- manual or auto from matching project plan milestone
  invoice_id text,
  payment_status payment_status_type default 'Not Paid',
  pending_milestone_amount numeric(12,2),
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PEOPLE
-- ============================================================
create table if not exists people (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  email text,
  role text,
  team text default 'Client',            -- 'Client' or 'Leucine'
  phone text,
  created_at timestamptz default now()
);

-- ============================================================
-- UAT
-- ============================================================
create table if not exists uat_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  test_case text,
  description text,
  status task_status default 'Not Started',
  tester text,
  comments text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- RAID
-- ============================================================
create table if not exists raid_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  type text not null check (type in ('risk','assumption','issue','dependency')),
  title text not null,
  description text,
  impact text,
  probability text,
  status text,
  owner text,
  due_date date,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FEEDBACK
-- ============================================================
create table if not exists feedback_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  date date,
  source text,
  feedback text,
  action_taken text,
  status text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  url text,
  category text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- DEALS (All Deals — global, not per-project)
-- ============================================================
create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete set null, -- linked project
  deal_name text not null,
  record_id text,
  status deal_status_type default 'Under Onboarding',
  po_date date,
  kickoff_date date,
  go_live_date date,          -- = planned go-live from project health
  sow_completion_date date,   -- = planned go-live date (same field)
  target_sow_completion_days int,
  actual_onboarding_days int,
  expected_sow_completion_pct numeric(5,2),
  current_sow_completion_pct numeric(5,2),
  delta_pct numeric(5,2),     -- expected - actual
  context text,
  critical_next_actions text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PENDING REVENUE CUSTOM COLUMNS (admin-defined extra columns)
-- ============================================================
create table if not exists pending_revenue_columns (
  id uuid primary key default uuid_generate_v4(),
  column_key text unique not null,        -- internal key
  column_label text not null,             -- display name
  cell_type text default 'text',          -- 'text' or 'dropdown'
  dropdown_options jsonb default '[]',    -- array of strings if dropdown
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- PENDING REVENUE CELL OVERRIDES (custom column values per row)
-- ============================================================
create table if not exists pending_revenue_cells (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid references payments(id) on delete cascade,
  column_key text not null,
  value text,
  unique(payment_id, column_key)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_access enable row level security;
alter table milestones enable row level security;
alter table project_plan enable row level security;
alter table sow_items enable row level security;
alter table sow_dropdown_options enable row level security;
alter table payments enable row level security;
alter table people enable row level security;
alter table uat_items enable row level security;
alter table raid_items enable row level security;
alter table feedback_items enable row level security;
alter table documents enable row level security;
alter table deals enable row level security;
alter table pending_revenue_columns enable row level security;
alter table pending_revenue_cells enable row level security;

-- Drop existing policies safely
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Helper: is the current user leadership or admin?
create or replace function is_leadership_or_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','leadership'));
$$;

-- Helper: can the current user edit a project?
create or replace function can_edit_project(pid uuid)
returns boolean language sql security definer as $$
  select
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from projects where id = pid and dm_id = auth.uid())
    or exists (select 1 from project_access where project_id = pid and user_id = auth.uid() and can_edit = true);
$$;

-- Helper: can the current user view a project?
create or replace function can_view_project(pid uuid)
returns boolean language sql security definer as $$
  select
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','leadership'))
    or exists (select 1 from projects where id = pid and dm_id = auth.uid())
    or exists (select 1 from project_access where project_id = pid and user_id = auth.uid());
$$;

-- ---- PROFILES ----
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_admin" on profiles for insert with check (is_admin());

-- ---- CATEGORIES ----
create policy "categories_select" on categories for select using (true);

-- ---- PROJECTS ----
create policy "projects_select" on projects for select using (can_view_project(id));
create policy "projects_insert" on projects for insert with check (
  auth.uid() is not null and
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','dm'))
);
create policy "projects_update" on projects for update using (can_edit_project(id));
create policy "projects_delete" on projects for delete using (is_admin());

-- ---- PROJECT ACCESS ----
create policy "project_access_select" on project_access for select using (
  user_id = auth.uid() or is_admin()
);
create policy "project_access_insert" on project_access for insert with check (is_admin() or can_edit_project(project_id));
create policy "project_access_delete" on project_access for delete using (is_admin());

-- ---- MILESTONES ----
create policy "milestones_select" on milestones for select using (can_view_project(project_id));
create policy "milestones_insert" on milestones for insert with check (can_edit_project(project_id));
create policy "milestones_update" on milestones for update using (can_edit_project(project_id));
create policy "milestones_delete" on milestones for delete using (can_edit_project(project_id));

-- ---- PROJECT PLAN ----
create policy "plan_select" on project_plan for select using (can_view_project(project_id));
create policy "plan_insert" on project_plan for insert with check (can_edit_project(project_id));
create policy "plan_update" on project_plan for update using (can_edit_project(project_id));
create policy "plan_delete" on project_plan for delete using (can_edit_project(project_id));

-- ---- SOW ITEMS ----
create policy "sow_select" on sow_items for select using (can_view_project(project_id));
create policy "sow_insert" on sow_items for insert with check (can_edit_project(project_id));
create policy "sow_update" on sow_items for update using (can_edit_project(project_id));
create policy "sow_delete" on sow_items for delete using (can_edit_project(project_id));

-- ---- SOW DROPDOWN OPTIONS ----
create policy "sow_dd_select" on sow_dropdown_options for select using (can_view_project(project_id));
create policy "sow_dd_upsert" on sow_dropdown_options for insert with check (is_admin());
create policy "sow_dd_update" on sow_dropdown_options for update using (is_admin());

-- ---- PAYMENTS ----
create policy "payments_select" on payments for select using (can_view_project(project_id));
create policy "payments_insert" on payments for insert with check (can_edit_project(project_id));
create policy "payments_update" on payments for update using (can_edit_project(project_id));
create policy "payments_delete" on payments for delete using (can_edit_project(project_id));

-- ---- PEOPLE ----
create policy "people_select" on people for select using (can_view_project(project_id));
create policy "people_insert" on people for insert with check (can_edit_project(project_id));
create policy "people_update" on people for update using (can_edit_project(project_id));
create policy "people_delete" on people for delete using (can_edit_project(project_id));

-- ---- UAT ----
create policy "uat_select" on uat_items for select using (can_view_project(project_id));
create policy "uat_insert" on uat_items for insert with check (can_edit_project(project_id));
create policy "uat_update" on uat_items for update using (can_edit_project(project_id));
create policy "uat_delete" on uat_items for delete using (can_edit_project(project_id));

-- ---- RAID ----
create policy "raid_select" on raid_items for select using (can_view_project(project_id));
create policy "raid_insert" on raid_items for insert with check (can_edit_project(project_id));
create policy "raid_update" on raid_items for update using (can_edit_project(project_id));
create policy "raid_delete" on raid_items for delete using (can_edit_project(project_id));

-- ---- FEEDBACK ----
create policy "feedback_select" on feedback_items for select using (can_view_project(project_id));
create policy "feedback_insert" on feedback_items for insert with check (can_edit_project(project_id));
create policy "feedback_update" on feedback_items for update using (can_edit_project(project_id));
create policy "feedback_delete" on feedback_items for delete using (can_edit_project(project_id));

-- ---- DOCUMENTS ----
create policy "docs_select" on documents for select using (can_view_project(project_id));
create policy "docs_insert" on documents for insert with check (can_edit_project(project_id));
create policy "docs_delete" on documents for delete using (can_edit_project(project_id));

-- ---- DEALS ----
create policy "deals_select" on deals for select using (is_leadership_or_admin());
create policy "deals_insert" on deals for insert with check (is_admin());
create policy "deals_update" on deals for update using (is_admin());
create policy "deals_delete" on deals for delete using (is_admin());

-- ---- PENDING REVENUE COLUMNS ----
create policy "pr_cols_select" on pending_revenue_columns for select using (is_leadership_or_admin());
create policy "pr_cols_insert" on pending_revenue_columns for insert with check (is_admin());
create policy "pr_cols_update" on pending_revenue_columns for update using (is_admin());
create policy "pr_cols_delete" on pending_revenue_columns for delete using (is_admin());

-- ---- PENDING REVENUE CELLS ----
create policy "pr_cells_select" on pending_revenue_cells for select using (is_leadership_or_admin());
create policy "pr_cells_upsert" on pending_revenue_cells for insert with check (is_admin());
create policy "pr_cells_update" on pending_revenue_cells for update using (is_admin());

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'dm')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- TRIGGER: auto-update projects.updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();

drop trigger if exists plan_updated_at on project_plan;
create trigger plan_updated_at before update on project_plan
  for each row execute function update_updated_at();

drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at before update on payments
  for each row execute function update_updated_at();

-- ============================================================
-- FUNCTION: sync deal record from project health
-- Called after project health fields are updated
-- ============================================================
create or replace function sync_deal_from_project(project_uuid uuid)
returns void language plpgsql security definer as $$
declare
  proj record;
  existing_deal uuid;
begin
  select * into proj from projects where id = project_uuid;
  select id into existing_deal from deals where project_id = project_uuid limit 1;

  if existing_deal is not null then
    update deals set
      deal_name = proj.name,
      po_date = proj.po_date,
      kickoff_date = proj.kickoff_date,
      go_live_date = proj.planned_go_live,
      sow_completion_date = proj.planned_go_live,
      target_sow_completion_days = proj.target_onboarding_days,
      actual_onboarding_days = proj.actual_onboarding_days,
      updated_at = now()
    where id = existing_deal;
  else
    insert into deals (project_id, deal_name, po_date, kickoff_date, go_live_date,
      sow_completion_date, target_sow_completion_days, actual_onboarding_days)
    values (project_uuid, proj.name, proj.po_date, proj.kickoff_date, proj.planned_go_live,
      proj.planned_go_live, proj.target_onboarding_days, proj.actual_onboarding_days);
  end if;
end;
$$;
