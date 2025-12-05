# Google OAuth Setup Guide for Client Report System

This guide walks you through setting up Google OAuth authentication from scratch for the Client Report dashboard.

---

## Overview

The authentication flow requires:
1. Google Cloud Console project with OAuth 2.0 credentials
2. Supabase Google auth provider configuration
3. Proper redirect URLs configured in both systems

---

## Part 1: Google Cloud Console Setup

### Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with a Google account (preferably a StudioHawk admin account)
3. Click the project dropdown at the top of the page
4. Click **"New Project"** or select an existing project
   - **Project Name:** `StudioHawk Client Reports` (or similar)
   - **Organization:** StudioHawk (if available)
   - Click **"Create"**

### Step 2: Enable Google+ API (Required for OAuth)

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for **"Google+ API"**
3. Click on it and click **"Enable"**
   - Note: Even though Google+ is deprecated, the API is still required for OAuth user info

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **"Internal"** (recommended if you have Google Workspace)
   - This restricts sign-in to @studiohawk.com.au accounts only
   - If you don't have Google Workspace, choose **"External"** and add test users
3. Click **"Create"**

#### Fill in the App Information:

**App Information:**
- **App name:** `StudioHawk Client Reports`
- **User support email:** Choose your email from dropdown
- **App logo:** (Optional) Upload StudioHawk logo

**App domain:**
- **Application home page:** `http://localhost:3001` (for now, update later for production)
- **Application privacy policy link:** (Optional, can add later)
- **Application terms of service link:** (Optional, can add later)

**Authorized domains:**
- Click **"Add domain"**
- Add: `supabase.co`
- Add: `studiohawk.com.au` (if using custom domain later)

**Developer contact information:**
- Add your email address

4. Click **"Save and Continue"**

#### Scopes:

1. Click **"Add or Remove Scopes"**
2. Select these scopes:
   - `openid`
   - `email`
   - `profile`
   - Or search for: `.../auth/userinfo.email` and `.../auth/userinfo.profile`
3. Click **"Update"** then **"Save and Continue"**

#### Test Users (only if using External):

- If you selected "External", add test users:
  - `dani@studiohawk.com.au`
  - `georgia.anderson@studiohawk.com.au`
  - `daisy@studiohawk.com.au`
- Click **"Save and Continue"**

5. Review summary and click **"Back to Dashboard"**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **"Create Credentials"** at the top
3. Select **"OAuth client ID"**

#### Configure OAuth Client:

**Application type:** Web application

**Name:** `StudioHawk Client Reports - Supabase`

**Authorized JavaScript origins:**
- Click **"Add URI"**
- Add: `http://localhost:3001` (for local development)
- Add: `https://ylnrkfpchrzvuhqrnwco.supabase.co` (your Supabase project URL)
- Add your production frontend URL when you deploy (e.g., `https://reports.studiohawk.com.au`)

**Authorized redirect URIs:**
- Click **"Add URI"**
- Add: `https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/callback`
  - This is CRITICAL - this is where Supabase receives the OAuth callback
- Add: `http://localhost:3001/auth/callback` (for testing, optional)

4. Click **"Create"**

### Step 5: Save Your Credentials

A modal will appear with your credentials:
- **Client ID:** (starts with something like `123456789-xxx.apps.googleusercontent.com`)
- **Client Secret:** (random string like `GOCSPX-xxxxxxxxxxxxx`)

**IMPORTANT:** Copy both of these - you'll need them for Supabase configuration

You can also download the JSON file for backup:
- Click **"Download JSON"** (optional, for backup)
- Store it securely (DO NOT commit to git)

---

## Part 2: Supabase Configuration

### Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project: `ylnrkfpchrzvuhqrnwco`
3. Go to **Authentication** in the left sidebar

### Step 2: Configure Google Provider

1. Click **Providers** in the Authentication section
2. Find **Google** in the list
3. Click to expand the Google provider settings

#### Configure Google Provider:

**Enable Google provider:** Toggle ON

**Client ID (OAuth 2.0):**
- Paste the Client ID from Google Cloud Console
- Example: `123456789-abcdefghijk.apps.googleusercontent.com`

**Client Secret (OAuth 2.0):**
- Paste the Client Secret from Google Cloud Console
- Example: `GOCSPX-xxxxxxxxxxxxx`

**Authorized Client IDs:** (Leave empty unless you need this)

**Skip nonce checks:** Leave unchecked (default)

4. Click **"Save"**

### Step 3: Configure Site URL and Redirect URLs

1. In Supabase dashboard, go to **Authentication → URL Configuration**

**Site URL:**
- Set to: `http://localhost:3001` (for development)
- Update to your production URL when deploying (e.g., `https://reports.studiohawk.com.au`)

**Redirect URLs:**
- Add to allowlist:
  - `http://localhost:3001/auth/callback`
  - `http://localhost:3000/auth/callback` (backup port)
  - Your production URL + `/auth/callback` (add when deploying)

2. Click **"Save"**

### Step 4: Verify Authentication Settings

1. Go to **Authentication → Policies** (if you haven't already)
2. Verify RLS policies are configured (should be done from your schema)

---

## Part 3: Environment Variables

Your `.env.local` file already has the Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ylnrkfpchrzvuhqrnwco.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

No changes needed here - the Google OAuth credentials are stored in Supabase, not in your app.

---

## Part 4: Testing the Authentication Flow

### Test Locally

1. Make sure no dev server is running:
   ```bash
   # Kill any existing Next.js processes
   taskkill /F /IM node.exe /FI "WINDOWTITLE eq *next dev*"
   ```

2. Start your development server:
   ```bash
   cd my-website
   npm run dev
   ```

3. Open your browser to `http://localhost:3001/login`

4. Click **"Sign in with Google"**

5. You should be redirected to Google's OAuth consent screen

6. Sign in with a @studiohawk.com.au account

7. After consent, you should be redirected back to `/auth/callback`

8. The callback route will:
   - Exchange the code for a session
   - Verify the email ends with `@studiohawk.com.au`
   - Redirect to `/dashboard` if successful
   - Redirect to `/login?error=unauthorized` if not a StudioHawk email

### Expected Flow Diagram

```
User clicks "Sign in with Google"
  ↓
Supabase redirects to Google OAuth
  ↓
User signs in with Google
  ↓
Google redirects to: https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/callback?code=xxx
  ↓
Supabase exchanges code for session
  ↓
Supabase redirects to: http://localhost:3001/auth/callback?code=xxx
  ↓
Your app's callback route processes the code
  ↓
Verifies @studiohawk.com.au email
  ↓
Redirects to /dashboard (success) or /login?error=unauthorized (failure)
```

---

## Part 5: Troubleshooting

### Common Issues

**Issue: 500 Internal Server Error from Supabase**
- **Cause:** Google OAuth provider not configured in Supabase
- **Fix:** Complete Part 2 above

**Issue: "Redirect URI mismatch" error**
- **Cause:** The redirect URI in Google Cloud Console doesn't match Supabase's callback URL
- **Fix:** Ensure you added `https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/callback` exactly

**Issue: "Access blocked: This app's request is invalid"**
- **Cause:** OAuth consent screen not configured or missing scopes
- **Fix:** Complete Step 3 in Part 1 above

**Issue: User gets logged in but then logged out with "unauthorized" error**
- **Cause:** User's email doesn't end with @studiohawk.com.au
- **Fix:** This is expected behavior - only StudioHawk emails are allowed

**Issue: "Unable to verify user email" error**
- **Cause:** Email scope not requested or Google account doesn't have a verified email
- **Fix:** Ensure email scope is added in Google Cloud Console

### Check Supabase Logs

To see what's happening:

1. Go to Supabase Dashboard → **Logs**
2. Select **Auth Logs**
3. Look for errors related to Google OAuth
4. Check for failed login attempts and error messages

### Verify Google Cloud Console Settings

Double-check these URLs in Google Cloud Console:

**Authorized redirect URIs must include:**
- `https://ylnrkfpchrzvuhqrnwco.supabase.co/auth/v1/callback`

**Authorized JavaScript origins should include:**
- `http://localhost:3001` (development)
- `https://ylnrkfpchrzvuhqrnwco.supabase.co` (Supabase)

---

## Part 6: Moving to Production

When you're ready to deploy:

### Update Google Cloud Console:

1. Add your production frontend URL to:
   - Authorized JavaScript origins: `https://your-domain.com`
   - Authorized redirect URIs: `https://your-domain.com/auth/callback`

### Update Supabase:

1. Change Site URL to your production URL
2. Add production callback URL to redirect allowlist

### Update Frontend:

Your code already uses `window.location.origin` for the redirect, so it should work automatically:

```typescript
redirectTo: `${window.location.origin}/auth/callback`
```

---

## Security Notes

1. **Never commit Google OAuth credentials to git**
2. The Client Secret is sensitive - store it only in Supabase dashboard
3. Use "Internal" consent screen type if you have Google Workspace
4. The `hd: 'studiohawk.com.au'` parameter in the OAuth request restricts the account picker
5. The callback route double-checks email domain as an additional security layer
6. RLS policies ensure users can only see their assigned clients

---

## Summary Checklist

- [ ] Google Cloud project created
- [ ] OAuth consent screen configured (Internal type recommended)
- [ ] OAuth 2.0 credentials created with correct redirect URIs
- [ ] Client ID and Client Secret copied
- [ ] Supabase Google provider enabled and configured
- [ ] Supabase Site URL set to localhost (for now)
- [ ] Supabase redirect URLs allowlist configured
- [ ] Local testing completed successfully
- [ ] Production URLs added (when deploying)

---

## Next Steps After Authentication Works

1. Test with multiple @studiohawk.com.au users
2. Test that non-StudioHawk emails are rejected
3. Verify RLS policies work correctly (non-admins see only their clients)
4. Add user profile management UI
5. Deploy to production and update URLs

---

## Support & References

- [Supabase Google OAuth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- Your project docs: `SUPABASE_SETUP.md`, `ACTION_PLAN.md`
