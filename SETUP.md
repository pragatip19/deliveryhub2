# DeliveryHub v2 — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase project (free tier works)
- A Vercel account (free tier works)

---

## 1. Supabase Setup

### 1a. Create project
Go to https://supabase.com → New Project. Note your Project URL and anon key.

### 1b. Run schema
In Supabase → SQL Editor, run the two SQL files **in order**:
1. `supabase_schema_update.sql`
2. `supabase_schema_addendum.sql`

### 1c. Seed default categories
In SQL Editor:
```sql
INSERT INTO categories (name) VALUES
  ('MES'), ('Logbooks'), ('CLEEN'), ('DMS'),
  ('AI Investigator'), ('LMS'), ('AI Agents')
ON CONFLICT (name) DO NOTHING;
```

### 1d. Configure Auth
- Supabase Dashboard → Authentication → URL Configuration
- Set **Site URL** to your Vercel domain (e.g. `https://delivery-hub.vercel.app`)
- Add to **Redirect URLs**: `https://delivery-hub.vercel.app/email-confirmed`

### 1e. (Optional) Set up first admin user
After deploying and signing up with your leucinetech.com email, run:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@leucinetech.com';
```

---

## 2. Local Development

```bash
# 1. Copy env file
cp .env.example .env

# 2. Fill in your Supabase credentials in .env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# 3. Install dependencies
npm install

# 4. Start dev server
npm run dev
```

App runs at http://localhost:5173

---

## 3. Deploy to Vercel

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repo in the Vercel dashboard:
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

The `vercel.json` file already handles SPA routing (all paths → index.html).

---

## 4. App Roles

| Role | Access |
|------|--------|
| **Admin** | Full access. Can edit all projects, manage users, manage Deals |
| **Delivery Manager (DM)** | Can edit only their own projects. Sees My Projects by default. |
| **Leadership** | Read-only access to all projects. Can view Deals section. |

New signups default to **Delivery Manager** role. Promote via Admin Panel.

---

## 5. Key Features

- **Project templates** auto-load on project creation:
  - MES / DMS / AI Investigator / LMS / AI Agents → 13 milestones, 98 tasks, full UAT
  - Logbooks → 10 milestones, 57 tasks, simplified UAT
  - CLEEN → 10 milestones, 56 tasks, no UAT tab

- **Project Plan** auto-calculates dependency chains, plan freeze on In Progress, baseline locked after first set.

- **Milestones Gantt** auto-dates from plan tasks.

- **Deals section** (admin + leadership): All Deals, Pending Revenue, Revenue Projection — all auto-populated from project data.

- **Only @leucinetech.com emails** can sign up.

---

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank screen after email confirm | Make sure `/email-confirmed` is in Supabase Redirect URLs |
| RLS errors in console | Re-run the schema SQL; check helper functions exist |
| Categories missing | Run the seed SQL in step 1c |
| Auth not redirecting | Double-check VITE_SUPABASE_URL starts with `https://` |
