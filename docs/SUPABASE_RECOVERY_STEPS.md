# Supabase Project Recovery Steps

## Current Issue (Dec 5, 2025)

Your Supabase project shows:
- ✅ Database: Healthy
- ⚠️ PostgREST: Unhealthy
- ⚠️ Auth: Unhealthy
- ⚠️ Edge Functions: Unhealthy

This is why you're getting 500 errors when trying to sign in.

---

## Option 1: Wait for Auto-Recovery (Try This First)

The dashboard says "Recently restored projects can take up to 5 minutes to become fully operational."

**Wait 5-10 minutes**, then refresh the dashboard and check if services turn green.

While waiting, you can monitor by running this command every minute:

```bash
curl -I https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/health
```

When you see `HTTP/1.1 200 OK` instead of `500`, the auth service is back online.

---

## Option 2: Restart the Project

If after 10 minutes the services are still unhealthy:

### Step 1: Restart from Dashboard

1. Go to your project: https://supabase.com/dashboard/project/ylnrkfpchrzvuhqrnwco
2. Click **Settings** in the left sidebar
3. Scroll to **General** section
4. Look for a **"Restart Project"** or **"Pause/Resume"** button
5. Click to restart the project
6. Wait 5 minutes for services to come back online

### Step 2: Check Project Status

After restart:
1. Go back to the home dashboard
2. Check the **Project Status** panel (top right)
3. Verify all services show as "Healthy" (green checkmarks)

---

## Option 3: Check for Database Issues

If services won't start, there might be a database issue blocking them.

### Check Postgres Logs

1. In Supabase dashboard, go to **Logs**
2. Select **Postgres Logs**
3. Look for any errors related to:
   - Connection failures
   - Migration errors
   - Permission issues
   - Out of memory errors

### Check Auth Logs

1. Go to **Authentication** → **Logs**
2. Look for startup errors or configuration issues

### Security Advisory Issues

Your dashboard shows **34 issues need attention** with **13 SECURITY** issues.

One visible issue: `View 'public.task_breakdown' is defined with the SECURITY DEFINER`

**This might be blocking service startup.** Check the security tab:

1. Click on **SECURITY (13)** tab at the bottom
2. Review all security issues
3. Look for any that say "blocking" or "critical"

---

## Option 4: Fix Security Issues

The security warnings might be preventing services from starting.

### View the Full Security Report

1. In the dashboard, scroll to the bottom
2. Click the **SECURITY** tab (shows 13 issues)
3. Click each issue to see details

### Common Security Fixes

If you see issues about `SECURITY DEFINER`:

These are likely from your RLS helper functions. They're warnings but shouldn't block the service. However, if Supabase is enforcing stricter security, you might need to adjust.

**Check if this is the issue:**
1. Go to **SQL Editor**
2. Run this query to see all SECURITY DEFINER functions:

```sql
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true
AND n.nspname NOT IN ('pg_catalog', 'information_schema');
```

If `is_admin()` appears and is causing issues, this is expected (it's needed for RLS).

---

## Option 5: Contact Supabase Support

If nothing works after 30 minutes:

### Submit a Support Request

1. In Supabase dashboard, click the **?** icon (Help)
2. Select **Contact Support**
3. Describe the issue:

```
Subject: PostgREST and Auth services unhealthy after project restore

Description:
Project ID: ylnrkfpchrzvuhqrnwco
Issue: Auth and PostgREST services showing as "Unhealthy" for more than 30 minutes
Impact: Unable to authenticate users, all auth endpoints returning 500 errors
Database: Healthy (queries work fine)

Steps tried:
- Waited 10+ minutes for auto-recovery
- Attempted project restart
- Checked logs for errors

Request: Please restart/recover the Auth and PostgREST services
```

### Check Supabase Status Page

Visit: https://status.supabase.com/

See if there's a wider outage affecting your region.

---

## What Caused This?

Based on the dashboard message about "recently restored projects," this suggests:

1. **Your project was paused** (possibly due to inactivity on the free tier)
2. **It was just restored** when you tried to access it
3. **Services are taking longer than expected** to start up

This is a known issue with Supabase free tier projects that get paused.

---

## Temporary Workaround: Skip Auth for Development

While waiting for Supabase to recover, you can temporarily test without auth:

### Disable Auth Middleware (Temporary Only)

Edit `my-website/src/middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // TEMPORARY: Skip auth while Supabase is recovering
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

This lets you access `/dashboard` without signing in, just to test the UI.

**⚠️ REMEMBER TO REVERT THIS** once auth is working!

---

## Prevention for Future

Once this is resolved:

### For Free Tier Projects

Supabase free tier projects pause after 7 days of inactivity:
- Visit the dashboard weekly to keep it active
- Or upgrade to a paid plan for 24/7 availability

### Enable Email Notifications

1. Go to **Settings** → **General**
2. Enable notifications for:
   - Project health issues
   - Service outages
   - Billing alerts

---

## Once Services Are Healthy

After all services show green checkmarks:

1. ✅ Verify auth endpoint works:
   ```bash
   curl https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/health
   ```
   Should return: `{"version":"..."}`

2. ✅ Test Google OAuth sign-in at `http://localhost:3001/login`

3. ✅ If you still get errors, check the Google OAuth configuration again

---

## Summary Timeline

1. **0-10 min**: Wait for auto-recovery
2. **10-15 min**: Try project restart if still unhealthy
3. **15-30 min**: Check logs and security issues
4. **30+ min**: Contact Supabase support

Most likely this will resolve itself within 10 minutes.
