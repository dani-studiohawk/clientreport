// Database types based on schema.sql
// These types match the Supabase database schema

export interface Client {
  id: string
  monday_item_id: number
  name: string
  dpr_lead_id: string | null
  dpr_support_ids: string[] | null
  seo_lead_name: string | null
  agency_value: number | null
  client_priority: string | null
  campaign_type: string | null
  campaign_start_date: string | null
  total_link_kpi: number | null
  total_links_achieved: number | null
  monthly_rate: number | null
  monthly_hours: number | null
  is_active: boolean
  report_status: string | null
  last_report_date: string | null
  last_invoice_date: string | null
  group_name: string | null
  region: 'AU' | 'US' | 'UK' | null
  created_at: string
  updated_at: string
}

export interface Sprint {
  id: string
  client_id: string
  monday_subitem_id: number
  name: string
  sprint_number: number | null
  sprint_label: string | null
  start_date: string
  end_date: string
  kpi_target: number
  kpi_achieved: number
  monthly_rate: number | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  clockify_id: string
  sprint_id: string | null
  client_id: string | null
  user_id: string
  project_id: string | null
  entry_date: string
  hours: number
  description: string | null
  task_category: string | null
  project_name: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string
  is_admin: boolean
  clockify_user_id: string | null
  monday_person_id: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Extended types with relations
export interface ClientWithDprLead extends Client {
  dpr_lead: { name: string } | null
}

export interface ClientWithSprints extends Client {
  sprints: Sprint[]
}

export interface SprintWithClient extends Sprint {
  clients: Client | null
}

export interface TimeEntryWithClient extends TimeEntry {
  clients: Client | null
  users: User | null
}

// API response types
export interface DashboardStats {
  clientCount: number
  timeEntriesCount: number
  totalHours: number
  activeSprintsCount: number
}

export interface ClientHours {
  client_id: string
  client_name: string
  total_hours: number
  entry_count: number
}

// Filter types
export interface TimeEntryFilters {
  clientId?: string
  startDate?: string
  endDate?: string
  userName?: string
  billable?: boolean
}

export interface ClientFilters {
  region?: 'AU' | 'US' | 'UK'
  status?: string
  search?: string
}
