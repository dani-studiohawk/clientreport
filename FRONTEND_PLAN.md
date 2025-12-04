# Client Report System - Frontend Implementation Plan

> **Created:** December 4, 2025
> **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase
> **Estimated Duration:** 5-6 weeks

---

## Overview

Building a secure reporting dashboard for StudioHawk to track client sprints, team hours, and contract KPIs.

### Key Users
1. **Admin Users** (dani@, georgia.anderson@, daisy@) - See all clients/data
2. **DPR Leads** - See only their assigned clients

### Core Features
1. Sprint list with health indicators and filtering
2. Sprint detail page with breakdowns (task, team, timeline)
3. Client list with contract metrics
4. Client detail page with sprint history
5. Admin dashboard for sync monitoring

---

## Tech Stack Decisions

| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 14 (App Router) | Server components, built-in routing, Vercel deploy |
| Language | TypeScript | Type safety, better DX |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Components | shadcn/ui | Accessible, customizable, modern |
| Data Fetching | Supabase JS + React Query | Real-time capable, caching |
| Auth | Supabase Auth | Already integrated with backend |
| Charts | Recharts | Simple, React-native, good for bar/line charts |
| Deployment | Vercel or Netlify | Easy Next.js deployment |

---

## Project Structure

```
my-website/                          # Next.js app (new folder)
├── src/
│   ├── app/                         # App Router pages
│   │   ├── (auth)/                  # Auth layout group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/             # Dashboard layout group
│   │   │   ├── sprints/
│   │   │   │   ├── page.tsx         # Sprint list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Sprint detail
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx         # Client list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Client detail
│   │   │   ├── admin/
│   │   │   │   └── page.tsx         # Admin dashboard
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx           # Sidebar + header
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Redirect to /sprints
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── sprints/
│   │   │   ├── SprintCard.tsx
│   │   │   ├── SprintList.tsx
│   │   │   ├── SprintFilters.tsx
│   │   │   ├── SprintMetrics.tsx
│   │   │   ├── TaskBreakdown.tsx
│   │   │   ├── TeamBreakdown.tsx
│   │   │   └── HoursChart.tsx
│   │   ├── clients/
│   │   │   ├── ClientCard.tsx
│   │   │   ├── ClientList.tsx
│   │   │   ├── ClientFilters.tsx
│   │   │   └── SprintHistory.tsx
│   │   ├── common/
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── HealthBadge.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   └── admin/
│   │       ├── SyncStatus.tsx
│   │       └── UserManagement.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Browser client
│   │   │   ├── server.ts            # Server client
│   │   │   └── middleware.ts        # Auth middleware
│   │   ├── queries/
│   │   │   ├── sprints.ts           # Sprint queries
│   │   │   ├── clients.ts           # Client queries
│   │   │   └── users.ts             # User queries
│   │   └── utils/
│   │       ├── formatters.ts        # Date, currency, etc.
│   │       └── constants.ts
│   ├── hooks/
│   │   ├── useUser.ts
│   │   ├── useSprints.ts
│   │   ├── useClients.ts
│   │   └── useAdmin.ts
│   ├── types/
│   │   ├── database.ts              # Supabase generated types
│   │   ├── sprint.ts
│   │   ├── client.ts
│   │   └── user.ts
│   └── providers/
│       ├── AuthProvider.tsx
│       └── QueryProvider.tsx
├── public/
│   └── logo.svg
├── .env.local
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## Data Flow

### Database Views → Frontend Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE                         │
├─────────────────────────────────────────────────────────────────┤
│  sprint_metrics view                                             │
│  ├─ client_name, sprint_number, start_date, end_date            │
│  ├─ hours_used, monthly_hours, kpi_target, kpi_achieved         │
│  ├─ health_status, days_remaining, billable_rate                │
│  └─ dpr_lead_name, is_active                                    │
├─────────────────────────────────────────────────────────────────┤
│  client_contract_metrics view                                    │
│  ├─ client_name, total_sprints, total_hours                     │
│  ├─ total_kpi_target, total_kpi_achieved                        │
│  └─ avg_billable_rate, contract_health                          │
├─────────────────────────────────────────────────────────────────┤
│  task_breakdown view                                             │
│  └─ sprint_id, task_category, hours                             │
├─────────────────────────────────────────────────────────────────┤
│  user_sprint_breakdown view                                      │
│  └─ sprint_id, user_name, hours                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND COMPONENTS                         │
├─────────────────────────────────────────────────────────────────┤
│  SprintCard.tsx ◄── sprint_metrics                              │
│  SprintList.tsx ◄── sprint_metrics[]                            │
│  TaskBreakdown.tsx ◄── task_breakdown                           │
│  TeamBreakdown.tsx ◄── user_sprint_breakdown                    │
│  ClientCard.tsx ◄── client_contract_metrics                     │
│  SprintHistory.tsx ◄── sprint_metrics[] (filtered by client)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Week-by-Week Implementation Plan

### Week 1: Foundation & Auth (Days 1-5)

#### Day 1-2: Project Setup
- [ ] Initialize Next.js 14 project with TypeScript
  ```bash
  npx create-next-app@latest my-website --typescript --tailwind --eslint --app --src-dir
  ```
- [ ] Install dependencies
  ```bash
  npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query
  npx shadcn-ui@latest init
  ```
- [ ] Configure environment variables
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://ylnrkfpchrzvuhqrnwco.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
  ```
- [ ] Set up Supabase clients (browser + server)
- [ ] Generate TypeScript types from Supabase
  ```bash
  npx supabase gen types typescript --project-id ylnrkfpchrzvuhqrnwco > src/types/database.ts
  ```

#### Day 3-4: Authentication
- [ ] Create login page with magic link
- [ ] Set up auth middleware for protected routes
- [ ] Create AuthProvider context
- [ ] Build logout functionality
- [ ] Add email domain validation UI feedback
- [ ] Test login flow end-to-end

#### Day 5: Layout & Navigation
- [ ] Install shadcn/ui components: button, card, avatar, dropdown-menu
- [ ] Create Sidebar component with navigation links
- [ ] Create Header component with user menu
- [ ] Create dashboard layout wrapper
- [ ] Add mobile responsive navigation
- [ ] Set up protected route wrapper

**Week 1 Deliverable:** User can login with @studiohawk.com.au email, see dashboard layout with sidebar

---

### Week 2: Sprint List Page (Days 6-10)

#### Day 6-7: Data Layer
- [ ] Create sprint queries (`lib/queries/sprints.ts`)
  ```typescript
  export async function getSprints(supabase: SupabaseClient) {
    return supabase.from('sprint_metrics').select('*')
  }
  ```
- [ ] Create `useSprints` hook with React Query
- [ ] Add TypeScript types for sprint data
- [ ] Test data fetching with RLS (admin vs non-admin)

#### Day 8-9: Sprint Card Component
- [ ] Install shadcn/ui: progress, badge
- [ ] Create ProgressBar component (reusable)
- [ ] Create HealthBadge component
  - KPI Complete → Green
  - Ahead → Blue
  - On Track → Green
  - Behind → Yellow
  - At Risk → Red
- [ ] Create SprintCard component
  - Client name + sprint number
  - KPI progress bar
  - Hours used progress bar
  - Days remaining indicator
  - Health status badge
  - DPR Lead name

#### Day 10: Sprint List & Filters
- [ ] Create SprintList component (grid layout)
- [ ] Create SprintFilters component
  - Health status filter (multi-select)
  - Active/Past toggle
  - Sort dropdown (Ending Soon, A-Z, Agency Value)
- [ ] Add search by client name
- [ ] Add loading skeletons
- [ ] Add empty state UI

**Week 2 Deliverable:** Sprint list page with cards, filtering, sorting, and search

---

### Week 3: Sprint Detail Page (Days 11-15)

#### Day 11-12: Page Layout & Metrics
- [ ] Create sprint detail page route
- [ ] Create SprintHeader component
  - Client name, sprint number
  - DPR Lead
  - Back button
- [ ] Create SprintMetrics cards
  - Financial: Agency Value, Monthly Rate, Billable Rate
  - Timeline: Start Date, End Date, Days Remaining
  - Progress: KPI Target vs Achieved, Hours Used vs Allocated

#### Day 13: Task Breakdown
- [ ] Create task breakdown query
- [ ] Create TaskBreakdown component
  - Table with task category + hours
  - Percentage of total
  - Color-coded rows
- [ ] Install shadcn/ui: table

#### Day 14: Team Breakdown
- [ ] Create team breakdown query
- [ ] Create TeamBreakdown component
  - Table with team member + hours
  - Avatar + name
  - Percentage of total

#### Day 15: Hours Chart
- [ ] Install Recharts
- [ ] Create HoursChart component
  - Bar chart of hours by date
  - Tooltip with date details
- [ ] Add responsive sizing

**Week 3 Deliverable:** Sprint detail page with all breakdowns and visualizations

---

### Week 4: Client Pages (Days 16-20)

#### Day 16-17: Client List Page
- [ ] Create client queries (`lib/queries/clients.ts`)
- [ ] Create ClientCard component
  - Client name
  - Current sprint status
  - Contract KPI progress
  - Region badge (AU/US/UK)
- [ ] Create ClientList component
- [ ] Create ClientFilters
  - Campaign Type
  - Region
  - DPR Lead
  - Active/Inactive

#### Day 18-19: Client Detail Page
- [ ] Create client detail page route
- [ ] Create ClientOverview component
  - Client info
  - Team assignments (DPR Lead, DPR Support)
  - Campaign details
- [ ] Create ContractSummary component
  - Total sprints
  - Total hours
  - Average KPI achievement
  - Average billable rate

#### Day 20: Sprint History
- [ ] Create SprintHistory component
  - Timeline view of all sprints
  - Expandable sprint items
  - Link to sprint detail page
- [ ] Add loading states

**Week 4 Deliverable:** Client list and detail pages with sprint history

---

### Week 5: Admin & Polish (Days 21-25)

#### Day 21-22: Admin Dashboard
- [ ] Create admin route (protected for is_admin users)
- [ ] Create SyncStatus component
  - Query sync_logs table
  - Show last sync time
  - Show success/failure status
  - Records synced count
- [ ] Create manual sync trigger buttons
  - Call Edge Functions via fetch
- [ ] Add sync history table

#### Day 23: Settings Page
- [ ] Create settings page
- [ ] User profile display (read-only)
- [ ] Display preferences (future)

#### Day 24-25: Polish & Responsive
- [ ] Test all pages on mobile
- [ ] Fix responsive issues
- [ ] Add page transitions
- [ ] Add error boundaries
- [ ] Add 404 page
- [ ] Performance optimization (lazy loading)

**Week 5 Deliverable:** Admin dashboard, settings, fully responsive design

---

### Week 6: Testing & Deployment (Days 26-30)

#### Day 26-27: Testing
- [ ] Test auth flows (login, logout, session refresh)
- [ ] Test RLS enforcement (admin vs non-admin views)
- [ ] Test all filters and sorting
- [ ] Test error states
- [ ] Cross-browser testing

#### Day 28-29: Deployment
- [ ] Set up Vercel/Netlify project
- [ ] Configure environment variables
- [ ] Deploy to production
- [ ] Configure custom domain (if applicable)
- [ ] Set up preview deployments

#### Day 30: Documentation & Handoff
- [ ] Update FRONTEND_PLAN.md with completion status
- [ ] Create user guide
- [ ] Record demo video
- [ ] Team training session

**Week 6 Deliverable:** Production deployment, documentation complete

---

## Component Specifications

### SprintCard Props
```typescript
interface SprintCardProps {
  id: string
  clientName: string
  sprintNumber: number
  healthStatus: 'KPI Complete' | 'Ahead' | 'On Track' | 'Behind' | 'At Risk'
  kpiTarget: number
  kpiAchieved: number
  hoursUsed: number
  monthlyHours: number
  daysRemaining: number
  dprLeadName: string
  endDate: string
}
```

### HealthBadge Variants
```typescript
const healthColors = {
  'KPI Complete': 'bg-green-500',
  'Ahead': 'bg-blue-500',
  'On Track': 'bg-green-400',
  'Behind': 'bg-yellow-500',
  'At Risk': 'bg-red-500',
}
```

### ProgressBar Props
```typescript
interface ProgressBarProps {
  value: number        // Current value
  max: number          // Maximum value
  label?: string       // Optional label
  showPercentage?: boolean
  color?: 'default' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}
```

---

## Color Palette (StudioHawk Branding)

```css
:root {
  /* Primary */
  --primary: #1a1a2e;        /* Dark navy */
  --primary-foreground: #ffffff;
  
  /* Accent */
  --accent: #e94560;         /* StudioHawk red */
  --accent-foreground: #ffffff;
  
  /* Health Status */
  --health-complete: #22c55e;  /* Green */
  --health-ahead: #3b82f6;     /* Blue */
  --health-on-track: #84cc16;  /* Lime */
  --health-behind: #eab308;    /* Yellow */
  --health-at-risk: #ef4444;   /* Red */
  
  /* Neutral */
  --background: #f8fafc;
  --foreground: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
}
```

---

## API Routes (Next.js)

While Supabase handles most data access, we may need API routes for:

```typescript
// src/app/api/sync/clockify/route.ts
export async function POST() {
  // Trigger Edge Function
  const response = await fetch(
    'https://ylnrkfpchrzvuhqrnwco.supabase.co/functions/v1/sync-clockify',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ days_back: 7 })
    }
  )
  return Response.json(await response.json())
}
```

---

## Security Checklist

- [ ] Environment variables not exposed to client (except NEXT_PUBLIC_*)
- [ ] RLS enforced on all Supabase queries
- [ ] Admin routes check is_admin before rendering
- [ ] No sensitive data in URL parameters
- [ ] HTTPS only in production
- [ ] Auth tokens stored securely (httpOnly cookies via Supabase SSR)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Lighthouse Performance | > 90 |
| Sprint list load time | < 2s |
| Sprint detail load time | < 1.5s |

---

## Dependencies to Install

```bash
# Core
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query

# UI
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card avatar dropdown-menu
npx shadcn-ui@latest add progress badge table input
npx shadcn-ui@latest add select checkbox dialog
npx shadcn-ui@latest add skeleton separator

# Charts
npm install recharts

# Utils
npm install date-fns
npm install clsx tailwind-merge
```

---

## Getting Started Commands

```bash
# 1. Create Next.js project (run from ClientReport parent folder)
npx create-next-app@latest my-website --typescript --tailwind --eslint --app --src-dir

# 2. Navigate to project
cd my-website

# 3. Install Supabase
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query

# 4. Initialize shadcn/ui
npx shadcn-ui@latest init

# 5. Generate Supabase types
npx supabase gen types typescript --project-id ylnrkfpchrzvuhqrnwco > src/types/database.ts

# 6. Create .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://ylnrkfpchrzvuhqrnwco.supabase.co" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here" >> .env.local

# 7. Start development
npm run dev
```

---

## Success Criteria

- [ ] Users can log in with @studiohawk.com.au email
- [ ] Non-admin users see only their assigned clients
- [ ] Admin users see all clients and team data
- [ ] Sprint list loads with health indicators and filtering
- [ ] Sprint detail shows task/team breakdowns and charts
- [ ] Client list shows contract metrics
- [ ] Client detail shows sprint history
- [ ] Admin can view sync status and trigger manual syncs
- [ ] All pages responsive on mobile
- [ ] Dashboard loads within 2 seconds
- [ ] No errors in console
- [ ] Lighthouse score > 90

---

## Hosting & Deployment

### Recommended: Vercel (Free Tier)

Vercel is the company behind Next.js, making it the most seamless deployment option.

**Why Vercel:**
- Zero-config deployment for Next.js
- Automatic preview deployments for PRs
- Edge functions and serverless API routes included
- Free SSL certificates
- Global CDN
- Free tier includes:
  - Unlimited static sites
  - 100GB bandwidth/month
  - Serverless function execution
  - Analytics (basic)

**Setup Steps:**
```bash
# 1. Install Vercel CLI (optional, can use web UI instead)
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy from my-website folder
cd my-website
vercel

# 4. For production deployment
vercel --prod
```

**Environment Variables in Vercel:**
1. Go to Project Settings → Environment Variables
2. Add these variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ylnrkfpchrzvuhqrnwco.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Variables will be automatically injected during build

**Custom Domain:**
1. Go to Project Settings → Domains
2. Add your domain (e.g., `reports.studiohawk.com.au`)
3. Update DNS records as instructed
4. SSL is automatic

**GitHub Integration (Recommended):**
1. Connect your GitHub repo to Vercel
2. Every push to `master` auto-deploys to production
3. Every PR creates a preview deployment with unique URL

### Alternative Options

| Platform | Pros | Cons | Cost |
|----------|------|------|------|
| **Vercel** | Best Next.js support, easy | Lock-in to their platform | Free tier available |
| **Netlify** | Good DX, form handling | Less optimized for Next.js | Free tier available |
| **AWS Amplify** | AWS ecosystem | More complex setup | Pay-as-you-go |
| **Cloudflare Pages** | Fast CDN, cheap | Limited serverless runtime | Free tier available |
| **Self-hosted (Docker)** | Full control | Requires server management | VPS costs ~$5-20/mo |

### Vercel + Supabase Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                                │
│                    (studiohawk.com.au)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js Application                     │   │
│  │  • Server Components (fetch data at edge)           │   │
│  │  • API Routes (/api/*)                              │   │
│  │  • Static assets (CDN cached)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  URL: https://your-app.vercel.app                          │
│  or   https://reports.studiohawk.com.au                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (Backend)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth       │  │   Database   │  │ Edge Funcs   │      │
│  │ (Google SSO) │  │  (Postgres)  │  │  (Syncs)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  URL: https://ylnrkfpchrzvuhqrnwco.supabase.co             │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Checklist

**Before First Deploy:**
- [ ] Remove any hardcoded API keys from code
- [ ] Ensure all secrets are in environment variables
- [ ] Test build locally: `npm run build`
- [ ] Check for TypeScript errors: `npm run type-check`
- [ ] Verify Supabase RLS policies are enabled

**Vercel Project Settings:**
- [ ] Framework Preset: Next.js (auto-detected)
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `.next` (default)
- [ ] Install Command: `npm install` (default)
- [ ] Root Directory: `my-website` (if monorepo)

**Post-Deploy:**
- [ ] Verify auth flow works with Google SSO
- [ ] Check that data loads from Supabase
- [ ] Test on mobile device
- [ ] Set up Vercel Analytics (optional)
- [ ] Configure Supabase redirect URLs for production domain

### Supabase Auth Configuration for Production

When you deploy to a custom domain, update Supabase auth settings:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Update:
   - Site URL: `https://reports.studiohawk.com.au`
   - Redirect URLs: Add `https://reports.studiohawk.com.au/**`

3. For Google OAuth:
   - Go to Google Cloud Console
   - Add production domain to authorized redirect URIs

### Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Vercel | Free/Pro | $0-20 |
| Supabase | Free | $0 |
| Domain (optional) | - | ~$15/year |
| **Total** | | **$0-20/mo** |

The free tiers should be sufficient for an internal tool with ~10-50 users.

---

## Notes & Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 4, 2025 | Use Next.js 14 App Router | Server components for better performance |
| Dec 4, 2025 | Use shadcn/ui | Accessible, customizable, works well with Tailwind |
| Dec 4, 2025 | Use React Query | Caching, background refetch, optimistic updates |
| Dec 4, 2025 | Put frontend in `my-website/` folder | Keep separate from backend scripts |
| Dec 4, 2025 | Host on Vercel | Best Next.js integration, free tier, easy deployment |

---

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Recharts Documentation](https://recharts.org/)
- [Tailwind CSS](https://tailwindcss.com/docs)
