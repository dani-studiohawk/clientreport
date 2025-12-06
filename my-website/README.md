# Client Report System - Frontend

Internal reporting dashboard for StudioHawk to track client engagement metrics, sprint health, and team time allocation.

## Production

**Live URL:** https://clientreport.vercel.app

**Stack:**
- Next.js 16.0.7 (App Router)
- TypeScript 5
- Tailwind CSS 4
- Supabase (Auth + Database)
- React Query 5
- Recharts 3

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- StudioHawk Google Workspace account

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   # Copy the example
   cp .env.example .env.local

   # Or create .env.local with:
   NEXT_PUBLIC_SUPABASE_URL=https://ylnrkfpchrzvuhqrnwco.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsbnJrZnBjaHJ6dnVocXJud2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODYxMDIsImV4cCI6MjA3OTI2MjEwMn0.YaoG6W-LlDaNW_6yhFPW0TigqnusTX1o9y9J74hmqbk
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:3000
   ```

5. **Login:**
   - Click "Sign in with Google"
   - Use your @studiohawk.com.au account

---

## Available Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Project Structure

```
my-website/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── auth/callback/            # OAuth callback handler
│   │   ├── login/                    # Login page
│   │   └── dashboard/                # Protected dashboard routes
│   │       ├── clients/              # Client list and detail pages
│   │       └── sprints/              # Sprint list and detail pages
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (15 components)
│   │   ├── dashboard/                # Dashboard layout (header, sidebar)
│   │   ├── sprints/                  # Sprint-related components
│   │   └── clients/                  # Client-related components
│   ├── lib/
│   │   ├── supabase/                 # Supabase client setup
│   │   │   ├── client.ts             # Browser client
│   │   │   ├── server.ts             # Server client
│   │   │   └── middleware.ts         # Auth middleware
│   │   ├── sprint-health.ts          # Health calculation utilities
│   │   └── utils.ts                  # General utilities
│   ├── types/
│   │   ├── database.ts               # Database type definitions
│   │   └── index.ts                  # Exported types
│   └── middleware.ts                 # Next.js route protection
├── public/                           # Static assets
├── .env.local                        # Environment variables (not committed)
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Dependencies and scripts
```

---

## Key Features

### Authentication
- Google OAuth with @studiohawk.com.au workspace restriction
- Automatic user creation on first login
- Role-based access (Admin vs DPR Lead)

### Dashboard Pages
1. **Sprint List** - View all sprints with filtering
2. **Sprint Detail** - Detailed metrics, charts, and breakdowns
3. **Client List** - All clients with search/filter
4. **Client Detail** - Sprint performance and metrics per client

### Data Visualization
- Sprint hours charts (Recharts)
- Task breakdown pie charts
- User hours breakdown
- Sprint health indicators

### Access Control
- **Admins:** See all clients and sprints
- **DPR Leads:** See only assigned clients
- Row-Level Security (RLS) enforced at database level

---

## Environment Variables

### Required for Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://ylnrkfpchrzvuhqrnwco.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) | `eyJhbGci...` |

**Note:** The `NEXT_PUBLIC_` prefix makes these variables available in the browser.

---

## Deployment

### Automatic Deployment (Current Setup)

Every push to `master` branch automatically deploys to Vercel:

```bash
git add .
git commit -m "Your changes"
git push origin master
```

Vercel will build and deploy in ~2-3 minutes.

### Manual Deployment

Via Vercel Dashboard:
1. Go to project in Vercel
2. Deployments tab
3. Click "..." on latest deployment
4. Click "Redeploy"

---

## Troubleshooting

### "Only @studiohawk.com.au accounts are allowed"
**Expected behavior.** The app is restricted to StudioHawk Google Workspace.

### Build fails with TypeScript errors
```bash
# Check for errors locally
npm run build

# Fix errors and redeploy
git add .
git commit -m "Fix TypeScript errors"
git push origin master
```

### Data not loading
1. Check you're logged in with correct account
2. Non-admin users only see their assigned clients (this is by design)
3. Check browser console (F12) for errors
4. Verify environment variables in Vercel

### Login redirect loop
1. Clear browser cookies and cache
2. Try incognito/private browsing
3. Verify Supabase redirect URLs include `http://localhost:3000/**`

---

## Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow existing component patterns
- Use Tailwind CSS for styling (no custom CSS)
- Prefer server components over client components

### Adding New Pages
1. Create page in `src/app/dashboard/[your-page]/page.tsx`
2. Add route to sidebar in `src/components/dashboard/sidebar.tsx`
3. Ensure authentication is required (middleware handles this)

### Database Queries
- Use Supabase client from `src/lib/supabase/server.ts` for server components
- Use Supabase client from `src/lib/supabase/client.ts` for client components
- RLS policies are automatically enforced

### Component Library
- Use shadcn/ui components from `src/components/ui/`
- Install new components via: `npx shadcn@latest add [component]`

---

## Performance

### Current Metrics
- Lighthouse Score: ~80+
- First Contentful Paint: <2s
- Time to Interactive: <3s

### Optimization Tips
- Use Next.js Image component for images
- Server components by default (faster initial load)
- React Query caches API responses
- Database indexes on frequently queried columns

---

## Documentation

- **Deployment Guide:** [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
- **Database Schema:** [../database/README.md](../database/README.md)
- **Design Notes:** [../database/DESIGN_NOTES.md](../database/DESIGN_NOTES.md)
- **Supabase Setup:** [../docs/SUPABASE_SETUP.md](../docs/SUPABASE_SETUP.md)

---

## Support

**Issues or questions?**
- Check documentation first
- Review error logs in browser console (F12)
- Contact: [your email]

**Production URL:** https://clientreport.vercel.app
**Maintained by:** Dani @ StudioHawk
