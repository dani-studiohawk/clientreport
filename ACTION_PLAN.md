# Client Report System - Detailed Action Plan

## Project Overview
Building a secure reporting dashboard for StudioHawk to track client sprints, team hours, and contract KPIs by integrating Monday.com (client data) and Clockify (time tracking).

---

## Phase 1: Database Design & Setup

### 1.1 Schema Design
- [ ] Create users table (email, name, is_admin, clockify_user_id, monday_person_id)
- [ ] Create clients table (monday_item_id, name, dpr_lead, agency_value, monthly_rate, monthly_hours, etc.)
- [ ] Create sprints table (client_id, sprint_number, start_date, end_date, kpi_target, kpi_achieved)
- [ ] Create time_entries table (clockify_id, sprint_id, user_id, task_category, hours, entry_date)
- [ ] Create clockify_projects table (clockify_id, name, client_id, hourly_rate)
- [ ] Create sync_logs table (source, sync_start, sync_end, status, records_synced)

### 1.2 Indexes & Constraints
- [ ] Add primary keys and foreign key constraints
- [ ] Create indexes on frequently queried fields (client_id, sprint_id, user_id, entry_date)
- [ ] Add unique constraints (emails, monday_item_id, clockify_id)
- [ ] Add check constraints for data validation

### 1.3 Calculation Functions
- [ ] Create function to calculate sprint health status
- [ ] Create function to calculate billable rate per sprint
- [ ] Create function to calculate hours utilization
- [ ] Create function to calculate contract-level aggregations
- [ ] Create function to calculate time elapsed/remaining

### 1.4 Views & Materialized Views
- [ ] Create sprint_metrics view (pre-calculated sprint KPIs)
- [ ] Create client_contract_metrics view (aggregate contract data)
- [ ] Create user_sprint_breakdown view (hours by user per sprint)
- [ ] Create task_breakdown view (hours by task category per sprint)
- [ ] Set up refresh schedule for materialized views

### 1.5 Security Setup
- [ ] Enable Row Level Security on all tables
- [ ] Create policy: Admins can SELECT/UPDATE all records
- [ ] Create policy: Non-admins can only SELECT their assigned clients
- [ ] Create policy: Prevent UPDATE/DELETE for non-admins
- [ ] Test RLS policies with different user roles

### 1.6 Initial Data
- [ ] Seed admin users (dani@, georgia.anderson@, daisy@)
- [ ] Create test client records
- [ ] Create test sprint records
- [ ] Create test time entries

---

## Phase 2: Data Integration & ETL

### 2.1 Monday.com Integration
- [ ] Set up Supabase Edge Function for Monday.com sync
- [ ] Implement GraphQL query to fetch board data
- [ ] Parse client information from Monday items
- [ ] Extract DPR Lead assignments (map person IDs to users)
- [ ] Extract campaign details (type, dates, priority, agency value)
- [ ] Store/update clients table
- [ ] Handle incremental updates vs full sync
- [ ] Add error handling and retry logic
- [ ] Log sync results to sync_logs table

### 2.2 Clockify Integration
- [ ] Set up Supabase Edge Function for Clockify sync
- [ ] Fetch time entries for date range
- [ ] Fetch workspace users and map to internal users
- [ ] Fetch projects and clients
- [ ] Map Clockify projects to internal clients
- [ ] Categorize time entries by sprint dates
- [ ] Determine task categories from time entry descriptions
- [ ] Store/update time_entries table
- [ ] Handle duplicate detection
- [ ] Add error handling and retry logic
- [ ] Log sync results to sync_logs table

### 2.3 Sprint Detection & Management
- [ ] Create logic to detect/create sprints from time entries
- [ ] Implement sprint numbering logic
- [ ] Calculate sprint start/end dates (3-month periods)
- [ ] Assign time entries to appropriate sprints
- [ ] Handle edge cases (overlapping dates, gaps)

### 2.4 Data Mapping & Enrichment
- [ ] Map Monday.com person IDs to user emails
- [ ] Map Clockify user IDs to internal users
- [ ] Link Clockify projects to clients
- [ ] Categorize time entries into task types (comms, data, etc.)
- [ ] Handle missing or ambiguous data

### 2.5 Automation & Scheduling
- [ ] Set up daily cron job for Monday.com sync
- [ ] Set up daily cron job for Clockify sync
- [ ] Configure sync timing (e.g., 2 AM daily)
- [ ] Implement sync status notifications
- [ ] Create admin dashboard to monitor sync health

---

## Phase 3: Authentication & Authorization

### 3.1 Supabase Auth Configuration
- [ ] Configure email magic link authentication
- [ ] Add email domain validation (@studiohawk.com.au only)
- [ ] Set up email templates
- [ ] Configure session duration
- [ ] Add password authentication as backup

### 3.2 User Management
- [ ] Create user registration flow
- [ ] Implement admin user seeding
- [ ] Create user profile page
- [ ] Add user role management (admin toggle)
- [ ] Implement user deactivation

### 3.3 Authorization Middleware
- [ ] Create auth context for frontend
- [ ] Implement protected route guards
- [ ] Add role-based component rendering
- [ ] Create API route protection
- [ ] Add session refresh logic

---

## Phase 4: Backend API Design

### 4.1 API Endpoints - Sprints
- [ ] GET /api/sprints - List sprints (filtered by user role)
- [ ] GET /api/sprints/:id - Get sprint details
- [ ] GET /api/sprints/:id/metrics - Get sprint calculations
- [ ] GET /api/sprints/:id/time-breakdown - Get hours by date
- [ ] GET /api/sprints/:id/task-breakdown - Get hours by task
- [ ] GET /api/sprints/:id/team-breakdown - Get hours by team member

### 4.2 API Endpoints - Clients
- [ ] GET /api/clients - List clients (filtered by user role)
- [ ] GET /api/clients/:id - Get client details
- [ ] GET /api/clients/:id/contract-metrics - Get contract-level KPIs
- [ ] GET /api/clients/:id/sprints - List all sprints for client
- [ ] GET /api/clients/:id/history - Get client sprint history

### 4.3 API Endpoints - Users & Admin
- [ ] GET /api/users/me - Get current user profile
- [ ] GET /api/users - List all users (admin only)
- [ ] GET /api/admin/sync-status - Get sync logs (admin only)
- [ ] POST /api/admin/trigger-sync - Manual sync trigger (admin only)

### 4.4 Data Minimization
- [ ] Create view layers that return only necessary fields
- [ ] Remove sensitive data from API responses
- [ ] Implement field-level permissions
- [ ] Add response payload size monitoring

---

## Phase 5: Frontend Setup & Architecture

### 5.1 Project Initialization
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS for styling
- [ ] Set up project structure (components, pages, utils, types)
- [ ] Configure environment variables
- [ ] Set up Supabase client

### 5.2 Design System
- [ ] Choose UI component library (shadcn/ui, MUI, etc.)
- [ ] Define color palette and theme
- [ ] Create reusable components (Button, Card, ProgressBar, etc.)
- [ ] Create layout components (Sidebar, Header, etc.)
- [ ] Set up responsive breakpoints

### 5.3 State Management
- [ ] Set up React Query for data fetching
- [ ] Create auth context provider
- [ ] Create user context provider
- [ ] Implement optimistic updates
- [ ] Add loading and error states

### 5.4 Routing & Navigation
- [ ] Set up Next.js app router
- [ ] Create protected route wrapper
- [ ] Implement sidebar navigation
- [ ] Add breadcrumbs
- [ ] Handle 404 and error pages

---

## Phase 6: Frontend - Sprints Feature

### 6.1 Sprint List Page
- [ ] Create sprint card component with progress bars
- [ ] Implement sprint list layout (grid/list view)
- [ ] Add filter controls (Sprint Health status)
- [ ] Add toggle for Active/Past clients
- [ ] Add sort dropdown (Ending Soon, A-Z, Agency Value, Priority)
- [ ] Implement search functionality
- [ ] Add loading skeletons
- [ ] Add empty state UI

### 6.2 Sprint Detail Page
- [ ] Create page layout with header (client name, DPR lead, nav button)
- [ ] Build financial overview card (agency value, monthly rate, billable rate)
- [ ] Build sprint breakdown card (dates, timeline, KPI progress)
- [ ] Create hours-by-date chart/graph
- [ ] Build task breakdown table
- [ ] Build team breakdown table
- [ ] Add export functionality (PDF/CSV)
- [ ] Add responsive design

### 6.3 Progress Visualizations
- [ ] Create KPI progress bar component
- [ ] Create hours used progress bar component
- [ ] Create days remaining progress bar component
- [ ] Add health status badge component
- [ ] Create timeline visualization component

---

## Phase 7: Frontend - Clients Feature

### 7.1 Clients List Page
- [ ] Design client card/list layout
- [ ] Display client overview (name, current sprint, contract KPI progress)
- [ ] Add search functionality
- [ ] Add filters (Campaign Type, Client Priority, DPR Lead)
- [ ] Add sort options (A-Z, Agency Value, Active Sprints)
- [ ] Show contract health indicators
- [ ] Add loading and empty states

### 7.2 Client Detail Page
- [ ] Create client overview card (details, team assignments)
- [ ] Build contract summary section (total sprints, KPIs, hours, avg rate)
- [ ] Create sprint history timeline
- [ ] Add expandable sprint items
- [ ] Show financial metrics overview
- [ ] Add navigation to individual sprint pages
- [ ] Implement responsive design

---

## Phase 8: Frontend - Settings & Admin

### 8.1 Settings Page
- [ ] User profile section (name, email, role)
- [ ] Notification preferences
- [ ] Display preferences (theme, defaults)
- [ ] Account security settings

### 8.2 Admin Dashboard (Admin Only)
- [ ] Sync status overview
- [ ] Manual sync triggers
- [ ] User management interface
- [ ] System health metrics
- [ ] Error logs viewer

---

## Phase 9: Testing

### 9.1 Database Testing
- [ ] Test all SQL functions with sample data
- [ ] Verify RLS policies work correctly
- [ ] Test constraint validations
- [ ] Performance test queries with large datasets
- [ ] Test materialized view refresh

### 9.2 API Testing
- [ ] Write integration tests for all endpoints
- [ ] Test authentication flows
- [ ] Test authorization (admin vs non-admin)
- [ ] Test error handling
- [ ] Load test API endpoints

### 9.3 Frontend Testing
- [ ] Write component unit tests
- [ ] Test user flows (login, view sprints, view clients)
- [ ] Test responsive design on multiple devices
- [ ] Test browser compatibility
- [ ] Accessibility testing (WCAG compliance)

### 9.4 Security Testing
- [ ] SQL injection testing
- [ ] XSS vulnerability testing
- [ ] CSRF protection verification
- [ ] Test RLS bypass attempts
- [ ] API rate limiting verification
- [ ] Sensitive data exposure audit

### 9.5 End-to-End Testing
- [ ] Test complete user journey (login → view data → logout)
- [ ] Test admin workflows
- [ ] Test data sync workflows
- [ ] Test error recovery scenarios

---

## Phase 10: Documentation

### 10.1 Technical Documentation
- [ ] Database schema documentation
- [ ] API endpoint documentation
- [ ] Data sync process documentation
- [ ] Deployment guide
- [ ] Environment variables reference

### 10.2 User Documentation
- [ ] User guide for viewing sprints
- [ ] User guide for viewing clients
- [ ] Admin guide for managing users
- [ ] Admin guide for monitoring syncs
- [ ] FAQ document

---

## Phase 11: Deployment & DevOps

### 11.1 Supabase Production Setup
- [ ] Create production Supabase project
- [ ] Run database migrations
- [ ] Configure environment variables
- [ ] Set up backup strategy
- [ ] Configure monitoring and alerts

### 11.2 Netlify Production Setup
- [ ] Connect GitHub repository
- [ ] Configure build settings
- [ ] Set up environment variables
- [ ] Configure custom domain (if applicable)
- [ ] Set up preview deployments

### 11.3 CI/CD Pipeline
- [ ] Set up GitHub Actions for testing
- [ ] Configure automatic deployments
- [ ] Add build status checks
- [ ] Set up deployment notifications

### 11.4 Monitoring & Logging
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure performance monitoring
- [ ] Set up uptime monitoring
- [ ] Create alerting rules
- [ ] Set up log aggregation

---

## Phase 12: Launch & Post-Launch

### 12.1 Initial Data Migration
- [ ] Run full Monday.com sync
- [ ] Run full Clockify sync
- [ ] Verify data accuracy
- [ ] Review calculated metrics
- [ ] Fix any data issues

### 12.2 User Onboarding
- [ ] Send login instructions to team
- [ ] Provide user guide links
- [ ] Schedule training session
- [ ] Collect initial feedback

### 12.3 Monitoring & Support
- [ ] Monitor system performance
- [ ] Monitor error rates
- [ ] Track user adoption
- [ ] Respond to user issues
- [ ] Iterate based on feedback

---

## Critical Dependencies & Blockers

1. **Supabase Project Access** - Need credentials to create/configure project
2. **Monday.com API Key** - Required for data sync
3. **Clockify API Key** - Required for data sync
4. **Sprint Detection Logic** - Need clarity on how sprints are defined/detected
5. **Task Categorization** - Need rules for categorizing time entries into task types
6. **KPI Definition** - Need clarity on what constitutes a "KPI" in Monday.com

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limiting | High | Implement caching, batch requests |
| Data mapping errors | High | Add validation, manual review process |
| Sprint detection complexity | Medium | Start with manual sprint creation |
| Performance with large datasets | Medium | Use pagination, indexes, caching |
| Security vulnerabilities | High | Regular audits, follow OWASP guidelines |
| User adoption | Medium | Good UX, training, documentation |

---

## Success Criteria

- [ ] All team members can log in with @studiohawk.com.au email
- [ ] Non-admin users see only their assigned clients
- [ ] Admin users see all clients and team data
- [ ] Sprint health is calculated accurately
- [ ] Data syncs daily without errors
- [ ] Dashboard loads within 2 seconds
- [ ] No sensitive data exposed via network tab
- [ ] System passes security audit
- [ ] 90%+ user satisfaction in feedback

---

## Timeline Estimate

- **Phase 1-2 (Database & ETL):** 1-2 weeks
- **Phase 3-4 (Auth & API):** 1 week
- **Phase 5-7 (Frontend):** 2-3 weeks
- **Phase 8-9 (Admin & Testing):** 1 week
- **Phase 10-12 (Docs & Deployment):** 1 week

**Total Estimated Time:** 6-8 weeks

---

## Next Immediate Actions

1. Create Supabase project
2. Design and implement database schema
3. Set up Monday.com data sync
4. Set up Clockify data sync
5. Build authentication layer
6. Start frontend development
