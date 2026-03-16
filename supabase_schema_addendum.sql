-- ============================================================
-- DeliveryHub v2 — Schema Addendum
-- Run AFTER supabase_schema_update.sql
-- ============================================================

-- Expand UAT items table for MES/Logbooks tracker structure
alter table uat_items add column if not exists group_name text default 'Logbooks / Processes';
alter table uat_items add column if not exists process_name text;
alter table uat_items add column if not exists uat_approver text;
alter table uat_items add column if not exists batch_1_status text default 'Not Started';
alter table uat_items add column if not exists batch_2_status text default 'Not Started';
alter table uat_items add column if not exists batch_3_status text default 'Not Started';
alter table uat_items add column if not exists batch_1_start date;
alter table uat_items add column if not exists batch_1_end date;
alter table uat_items add column if not exists batch_2_start date;
alter table uat_items add column if not exists batch_2_end date;
alter table uat_items add column if not exists batch_3_start date;
alter table uat_items add column if not exists batch_3_end date;
alter table uat_items add column if not exists paper_fields int;
alter table uat_items add column if not exists eliminated int;
alter table uat_items add column if not exists automated int;
alter table uat_items add column if not exists controlled int;
alter table uat_items add column if not exists remaining int;
alter table uat_items add column if not exists interlocks text;
alter table uat_items add column if not exists compliance_score text;

-- Restructure feedback_items to match actual template
-- (Rename existing columns if they exist, add new ones)
alter table feedback_items add column if not exists requirement text;
alter table feedback_items add column if not exists delivery_priority text;
alter table feedback_items add column if not exists clickup_task_id text;
alter table feedback_items add column if not exists development_status text;
alter table feedback_items add column if not exists due_date_committed date;

-- Drop old columns that no longer apply (safe with if exists check)
do $$ begin
  alter table feedback_items drop column if exists date;
  alter table feedback_items drop column if exists source;
  alter table feedback_items drop column if exists feedback;
  alter table feedback_items drop column if exists action_taken;
exception when others then null; end $$;

-- Projects: track which UAT type (derived from category, but storing for quick access)
alter table projects add column if not exists uat_type text; -- 'mes', 'logbooks', or null (CLEEN)
