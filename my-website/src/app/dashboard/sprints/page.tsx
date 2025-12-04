import { createClient } from '@/lib/supabase/server'
import { SprintCardGrid, SprintWithCalculations } from '@/components/sprints/sprint-card'
import { SprintFilters } from '@/components/sprints/sprint-filters'
import { calculateSprintHealth } from '@/lib/sprint-health'

// DPR Lead IDs - only these users should appear in the filter
const DPR_LEAD_IDS = [
  'd8bd96c3-dc49-4659-bdc2-1d0c857b7437', // Daisy
  'c782cca4-d6c4-46c5-b2cd-6f23ce117d3b', // Janine Tan Pacis
  '7b371e95-66b7-4f63-b3d2-c22fc2344cbe', // Paige Claydon
  'cd790f77-17a7-42e1-a079-995f3f093517', // Clea Kanning
  '4f92cdb2-b6dc-4c5b-8ccf-dacfbf923b79', // Georgia Anderson
]

interface SearchParams {
  health?: string
  clientId?: string
  dprLeadId?: string
  sort?: string
  activeOnly?: string
}

export default async function SprintsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  
  // Default activeOnly to true if not specified
  const activeOnly = params.activeOnly !== 'false'
  
  // Get sprints with client info including report_status to filter paused
  let query = supabase
    .from('sprints')
    .select(`
      *,
      clients (
        id,
        name,
        monthly_hours,
        report_status,
        dpr_lead_id,
        dpr_lead:users!clients_dpr_lead_id_fkey (
          id,
          name
        )
      )
    `)

  // Filter by active sprints only if toggle is on (default: ON)
  if (activeOnly) {
    query = query.eq('status', 'active')
  }

  // Filter by client
  if (params.clientId) {
    query = query.eq('client_id', params.clientId)
  }

  const { data: sprints, error } = await query

  if (error) {
    console.error('Error fetching sprints:', error)
  }

  // Get hours used per sprint using database function (much faster than fetching all entries)
  const sprintIds = sprints?.map(s => s.id) || []
  let hoursMap: Record<string, number> = {}
  
  if (sprintIds.length > 0) {
    const { data: hoursData } = await supabase
      .rpc('get_sprint_hours', { sprint_ids: sprintIds })
    
    if (hoursData) {
      hoursData.forEach((row: { sprint_id: string; total_hours: number }) => {
        hoursMap[row.sprint_id] = row.total_hours || 0
      })
    }
  }

  // Add hours to sprints and filter out paused campaigns
  let sprintsWithHours: SprintWithCalculations[] = (sprints || [])
    .filter(sprint => {
      // Filter out paused campaigns (Campaign Pause in report_status)
      const reportStatus = sprint.clients?.report_status
      if (reportStatus === 'Campaign Pause') return false
      return true
    })
    .map(sprint => ({
      ...sprint,
      hours_used: hoursMap[sprint.id] || 0,
    }))

  // Filter by DPR Lead
  if (params.dprLeadId) {
    sprintsWithHours = sprintsWithHours.filter(sprint => 
      sprint.clients?.dpr_lead_id === params.dprLeadId
    )
  }

  // Filter by health status (client-side calculation)
  if (params.health && params.health !== 'all') {
    sprintsWithHours = sprintsWithHours.filter(sprint => {
      const health = calculateSprintHealth(sprint)
      return health === params.health
    })
  }

  // Sort sprints - default to A-Z
  const sortOption = params.sort || 'a-z'
  sprintsWithHours.sort((a, b) => {
    switch (sortOption) {
      case 'ending-soon':
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
      case 'a-z':
        return (a.clients?.name || '').localeCompare(b.clients?.name || '')
      case 'z-a':
        return (b.clients?.name || '').localeCompare(a.clients?.name || '')
      case 'kpi-progress':
        const aProgress = a.kpi_target > 0 ? a.kpi_achieved / a.kpi_target : 0
        const bProgress = b.kpi_target > 0 ? b.kpi_achieved / b.kpi_target : 0
        return bProgress - aProgress
      case 'hours-used':
        return b.hours_used - a.hours_used
      default:
        return (a.clients?.name || '').localeCompare(b.clients?.name || '')
    }
  })

  // Get clients for filter dropdown
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Get DPR leads for filter dropdown - only specific users
  const { data: dprLeads } = await supabase
    .from('users')
    .select('id, name')
    .in('id', DPR_LEAD_IDS)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sprints</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Track sprint progress, KPIs, and time utilization
        </p>
      </div>

      {/* Filters */}
      <SprintFilters 
        clients={clients || []} 
        dprLeads={dprLeads || []}
      />

      {/* Sprint Cards */}
      <SprintCardGrid sprints={sprintsWithHours} />
    </div>
  )
}
