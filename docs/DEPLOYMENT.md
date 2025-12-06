# Client Report System - Deployment Guide

**Last Updated:** December 6, 2024
**Production URL:** https://clientreport.vercel.app
**Status:** ✅ Live and operational

---

## Deployment Architecture

### Frontend
- **Platform:** Vercel (Free tier)
- **URL:** https://clientreport.vercel.app
- **Framework:** Next.js 16.0.7 with App Router
- **Auto-deployment:** Enabled (deploys on push to `master` branch)

### Backend
- **Platform:** Supabase (Free tier)
- **Region:** Australia (Sydney)
- **Database:** PostgreSQL with Row-Level Security (RLS)
- **URL:** https://ylnrkfpchrzvuhqrnwco.supabase.co

### Authentication
- **Method:** Google OAuth (Workspace restricted)
- **Domain:** @studiohawk.com.au only
- **Type:** Internal OAuth app (not public)

---

## Environment Variables

### Vercel Production Environment
These are configured in Vercel Dashboard → Settings → Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://ylnrkfpchrzvuhqrnwco.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsbnJrZnBjaHJ6dnVocXJud2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODYxMDIsImV4cCI6MjA3OTI2MjEwMn0.YaoG6W-LlDaNW_6yhFPW0TigqnusTX1o9y9J74hmqbk
```

**Note:** These are public keys safe to expose in browser, but keep private as best practice.

---

## Google OAuth Configuration

### Google Cloud Console Setup

**Project:** Client Report System
**Console:** https://console.cloud.google.com/

**OAuth Consent Screen:**
- User Type: **Internal** (restricts to @studiohawk.com.au workspace)
- App name: Client Report System
- User support email: [your email]
- Developer contact: [your email]

**OAuth Credentials:**
- Application type: Web application
- Authorized JavaScript origins:
  ```
  https://ylnrkfpchrzvuhqrnwco.supabase.co
  https://clientreport.vercel.app
  ```
- Authorized redirect URIs:
  ```
  https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/callback
  ```

### Supabase OAuth Configuration

**Location:** Supabase Dashboard → Authentication → Providers → Google

- Google enabled: ✅
- Client ID: [from Google Cloud Console]
- Client Secret: [from Google Cloud Console]

**URL Configuration:**
- Site URL: `https://clientreport.vercel.app`
- Redirect URLs:
  ```
  https://clientreport.vercel.app/**
  http://localhost:3000/**
  ```

---

## Deployment Process

### Automatic Deployment (Recommended)

Every push to the `master` branch automatically triggers a Vercel deployment.

```bash
# Make changes to code
git add .
git commit -m "Your commit message"
git push origin master
```

Vercel will:
1. Detect the push
2. Build the Next.js app from `my-website` directory
3. Run TypeScript checks
4. Deploy to production
5. Update https://clientreport.vercel.app

**Build time:** ~2-3 minutes

### Manual Deployment

If you need to manually redeploy:

1. Go to Vercel Dashboard
2. Navigate to your project
3. Click "Deployments" tab
4. Find the latest deployment
5. Click "..." menu → "Redeploy"

---

## Vercel Project Configuration

**Critical settings:**
- Root Directory: `my-website` ⚠️ **Must be set!**
- Framework Preset: Next.js (auto-detected)
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Node.js Version: 18.x

---

## User Access Management

### Admin Users

Current admins with full access to all clients:
1. You (Dani)
2. Georgia
3. Daisy

**To add new admin:**
```sql
-- In Supabase SQL Editor
UPDATE users
SET is_admin = true
WHERE email = 'newadmin@studiohawk.com.au';
```

### DPR Lead Users

Non-admin users only see clients they're assigned to (via RLS policies).

**To assign a DPR Lead to a client:**
```sql
-- In Supabase SQL Editor
UPDATE clients
SET dpr_lead_id = (SELECT id FROM users WHERE email = 'lead@studiohawk.com.au')
WHERE name = 'Client Name';
```

### Adding New Users

New users are automatically created in the database on first login via Google OAuth. They are non-admin by default.

**To grant admin access:**
```sql
UPDATE users SET is_admin = true WHERE email = 'user@studiohawk.com.au';
```

---

## Monitoring & Maintenance

### Vercel Analytics

**Location:** Vercel Dashboard → Analytics

Monitor:
- Page views and unique visitors
- Performance metrics (Web Vitals)
- Error rates
- Geographic distribution

### Supabase Monitoring

**Location:** Supabase Dashboard → Logs

Monitor:
- Database queries and performance
- API requests
- Authentication events
- Edge Function executions

### Application Logs

Check for errors:
1. Vercel → Deployments → Latest → "Functions" tab
2. Supabase → Logs → Postgres Logs
3. Browser console (F12) for client-side errors

---

## Data Synchronization

### Current Setup

**Edge Functions Deployed:**
- `sync-clockify`: Syncs time entries from Clockify (last 7 days)
- `sync-monday`: Syncs clients and sprints from Monday.com boards

### Manual Sync

To manually trigger a sync:

**Option 1: Supabase Dashboard**
1. Go to Supabase → Edge Functions
2. Click on `sync-clockify` or `sync-monday`
3. Click "Invoke function"
4. Add body: `{"days_back": 7}` for Clockify, `{}` for Monday
5. Click "Invoke"

**Option 2: Command line (using curl)**
```bash
# Get service role key from .env file
SERVICE_ROLE_KEY="your-service-role-key"

# Sync Clockify (last 7 days)
curl -X POST https://ylnrkfpchrzvuhqrnwco.supabase.co/functions/v1/sync-clockify \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_back": 7}'

# Sync Monday.com
curl -X POST https://ylnrkfpchrzvuhqrnwco.supabase.co/functions/v1/sync-monday \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Automated Sync (TODO)

**Status:** ⚠️ pg_cron schedules need to be configured

See [Sync Automation Setup](#sync-automation-setup) below.

---

## Sync Automation Setup

### Option 1: pg_cron (Supabase native)

**Execute in Supabase SQL Editor:**

```sql
-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Schedule Clockify sync (daily at 2 AM UTC = 12 PM AEST)
SELECT cron.schedule(
  'sync-clockify-daily',
  '0 2 * * *',
  $$SELECT
    net.http_post(
      url:='https://ylnrkfpchrzvuhqrnwco.supabase.co/functions/v1/sync-clockify',
      headers:=jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE',
        'Content-Type', 'application/json'
      ),
      body:='{"days_back": 7}'::jsonb
    ) as request_id;$$
);

-- Step 3: Schedule Monday.com sync (weekly on Mondays at 3 AM UTC = 1 PM AEST)
SELECT cron.schedule(
  'sync-monday-weekly',
  '0 3 * * 1',
  $$SELECT
    net.http_post(
      url:='https://ylnrkfpchrzvuhqrnwco.supabase.co/functions/v1/sync-monday',
      headers:=jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE',
        'Content-Type', 'application/json'
      ),
      body:='{}'::jsonb
    ) as request_id;$$
);
```

**Replace `YOUR_SERVICE_ROLE_KEY_HERE`** with your actual service role key from `.env`

**Verify cron jobs:**
```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;
```

**Monitor cron executions:**
```sql
SELECT j.jobname, r.status, r.start_time, r.end_time
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
ORDER BY r.start_time DESC
LIMIT 20;
```

### Option 2: GitHub Actions (Alternative)

If pg_cron doesn't work on free tier, use GitHub Actions.

**Create file:** `.github/workflows/sync-data.yml`

```yaml
name: Sync Data

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
    - cron: '0 3 * * 1'  # Weekly Monday at 3 AM UTC
  workflow_dispatch:  # Allow manual triggering

jobs:
  sync-clockify:
    runs-on: ubuntu-latest
    steps:
      - name: Call Clockify Edge Function
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/sync-clockify \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"days_back": 7}'

  sync-monday:
    runs-on: ubuntu-latest
    needs: sync-clockify
    steps:
      - name: Call Monday Edge Function
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/sync-monday \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

**Add GitHub Secrets:**
Repository → Settings → Secrets and variables → Actions → New repository secret
- `SUPABASE_URL`: `https://ylnrkfpchrzvuhqrnwco.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: [from .env file]

---

## Checking Sync Status

### Check Sync Logs Table

```sql
-- In Supabase SQL Editor
SELECT
  sync_type,
  status,
  records_processed,
  created_at,
  error_details
FROM sync_logs
ORDER BY created_at DESC
LIMIT 20;
```

Expected output:
- `sync_type`: 'clockify' or 'monday'
- `status`: 'success' or 'error'
- `records_processed`: Number of records synced
- `error_details`: NULL if successful, error message if failed

### Verify Data Updated

```sql
-- Check latest time entries
SELECT * FROM time_entries ORDER BY created_at DESC LIMIT 10;

-- Check latest clients
SELECT * FROM clients ORDER BY updated_at DESC LIMIT 10;

-- Check latest sprints
SELECT * FROM sprints ORDER BY updated_at DESC LIMIT 10;
```

---

## Rollback Procedures

### Rolling Back a Deployment

If a deployment causes issues:

1. Go to Vercel Dashboard → Deployments
2. Find the last known good deployment
3. Click "..." menu → "Promote to Production"
4. Confirm the promotion

The site will immediately switch back to the previous version.

### Rolling Back Database Changes

If you need to revert database changes:

1. Restore from Supabase backup (if available)
2. Or manually revert using SQL migrations
3. Check `database/schema_backup_*.sql` for previous schemas

**Best practice:** Test database changes in a development environment first.

---

## Troubleshooting

### Login Issues

**Problem:** "Only @studiohawk.com.au accounts are allowed"
**Solution:** This is working as intended. Only StudioHawk Google Workspace accounts can access the app.

**Problem:** Google OAuth redirect error
**Solution:**
1. Check Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL` should be exactly `https://ylnrkfpchrzvuhqrnwco.supabase.co`
2. Verify Google Cloud Console redirect URI is `https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/callback`
3. Ensure JavaScript origins include both Supabase and Vercel URLs

**Problem:** Infinite redirect loop
**Solution:**
1. Clear browser cookies and cache
2. Try incognito/private browsing
3. Check Supabase redirect URLs include `https://clientreport.vercel.app/**`

### Data Not Loading

**Problem:** Dashboard loads but shows no data
**Solution:**
1. Check if you're logged in as the correct user
2. Non-admin users only see their assigned clients (this is by design)
3. Check RLS policies in Supabase
4. Run manual sync to update data

**Problem:** Data is stale/outdated
**Solution:**
1. Check when last sync ran (query `sync_logs` table)
2. Run manual sync via Supabase Edge Functions
3. Verify cron jobs are scheduled and running

### Build Failures

**Problem:** Vercel deployment fails
**Solution:**
1. Check build logs in Vercel Dashboard → Deployments → Failed deployment
2. Test build locally: `cd my-website && npm run build`
3. Fix TypeScript errors
4. Ensure all dependencies are in `package.json`
5. Push fix and Vercel will auto-deploy

**Problem:** Environment variable not found
**Solution:**
1. Check Vercel → Settings → Environment Variables
2. Ensure variables are set for Production, Preview, and Development
3. Redeploy after adding/updating environment variables

---

## Performance Optimization

### Current Performance
- Lighthouse Score: ~80+ (target)
- First Contentful Paint: <2s
- Time to Interactive: <3s

### Monitoring Performance
1. Open site in Chrome
2. Press F12 → Lighthouse tab
3. Run audit for Production URL
4. Review Performance, Accessibility, Best Practices, SEO scores

### If Performance Degrades
- Check Vercel Analytics for slow pages
- Review database query performance in Supabase
- Consider implementing caching for frequently accessed data
- Optimize images (use Next.js Image component)

---

## Security Considerations

### Environment Variables
- ✅ Never commit `.env` or `.env.local` files to git
- ✅ Use Vercel's environment variable management
- ✅ Rotate service role keys periodically (annually)

### Database Security
- ✅ Row-Level Security (RLS) enabled on all tables
- ✅ Service role key kept secret (never exposed to frontend)
- ✅ Anon key is public but has limited permissions

### Authentication
- ✅ Google OAuth with workspace domain restriction
- ✅ Internal OAuth app (not public)
- ✅ Session cookies are httpOnly and secure

---

## Cost Management

### Current Usage (Free Tiers)

**Vercel (Hobby - Free):**
- 100 GB bandwidth/month
- Unlimited deployments
- Current usage: ~1-5 GB/month (well within limits)

**Supabase (Free):**
- 500 MB database storage
- 1 GB file storage
- 2 GB bandwidth/month
- Current usage: ~50 MB database (well within limits)

**GitHub Actions (Free for private repos):**
- 2,000 minutes/month
- Current usage: ~10 minutes/month for syncs

### Upgrade Triggers
- Vercel: If >100 GB bandwidth or need >10 team members → $20/month
- Supabase: If >500 MB database or >50K active users → $25/month
- GitHub Actions: If >2,000 minutes/month → $0.008/minute

**Expected:** Should remain on free tiers indefinitely for internal tool with <50 users.

---

## Backup & Disaster Recovery

### Database Backups

**Automatic Backups (Supabase):**
- Daily backups retained for 7 days (free tier)
- Restore via Supabase Dashboard → Database → Backups

**Manual Backups:**
```bash
# Export schema to file
python scripts/pull_live_schema.py

# Creates: database/schema_live.sql
```

**Backup files:**
- `database/schema_live.sql` - Latest schema
- `database/schema_backup_*.sql` - Historical backups

### Code Backups
- GitHub repository serves as source of truth
- All commits are preserved
- Can rollback to any previous commit

### Recovery Plan
1. Restore database from Supabase backup
2. Rollback Vercel deployment to last known good version
3. If necessary, redeploy from GitHub commit
4. Verify authentication and data loading

---

## Support Contacts

**For deployment issues:**
- Check this document first
- Review error logs in Vercel and Supabase dashboards
- Contact: [your email]

**For access issues:**
- Ensure using @studiohawk.com.au Google account
- Contact admin to check user permissions
- Verify email is in `users` table

**For data sync issues:**
- Check `sync_logs` table for errors
- Verify API keys for Clockify and Monday.com are valid
- Run manual sync to test

---

## Future Enhancements

### Planned Improvements
1. ✅ Deployment to Vercel (COMPLETE)
2. ✅ Google OAuth authentication (COMPLETE)
3. ⏳ Automated sync scheduling (IN PROGRESS)
4. 🔜 Custom domain (optional): reports.studiohawk.com.au
5. 🔜 Email notifications for sprint health alerts
6. 🔜 CSV export functionality
7. 🔜 Admin panel for user management

### Technical Debt
- Add pagination for large client/sprint lists
- Implement data caching for better performance
- Add automated tests (E2E with Playwright)
- Set up error monitoring (Sentry or similar)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-06 | 1.0 | Initial deployment to Vercel with Google OAuth |
| 2024-12-05 | 0.9 | Frontend development complete |
| 2024-11-20 | 0.5 | Backend and database setup complete |

---

**Maintained by:** Dani
**Last reviewed:** December 6, 2024
