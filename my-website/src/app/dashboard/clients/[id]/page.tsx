import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format, differenceInDays } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SprintPerformanceChart } from '@/components/clients/sprint-performance-chart'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch client details with DPR lead
  const { data: client, error } = await supabase
    .from('clients')
    .select(`
      *,
      dpr_lead:users!clients_dpr_lead_id_fkey (
        id,
        name
      )
    `)
    .eq('id', id)
    .single()

  if (error || !client) {
    notFound()
  }

  // Fetch all sprints for this client
  const { data: sprints } = await supabase
    .from('sprints')
    .select('*')
    .eq('client_id', id)
    .order('sprint_number', { ascending: true })

  // Fetch all time entries for this client to calculate total hours
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('hours, sprint_id')
    .eq('client_id', id)

  // Calculate hours per sprint
  const hoursPerSprint: Record<string, number> = {}
  timeEntries?.forEach(entry => {
    if (entry.sprint_id) {
      hoursPerSprint[entry.sprint_id] = (hoursPerSprint[entry.sprint_id] || 0) + (entry.hours || 0)
    }
  })

  // Calculate contract-wide metrics
  const totalSprints = sprints?.length || 0
  const activeSprint = sprints?.find(s => s.status === 'active')
  const currentSprintNumber = activeSprint?.sprint_number || totalSprints
  
  // Contract period (first sprint start to last sprint end)
  const firstSprint = sprints?.[0]
  const lastSprint = sprints?.[sprints.length - 1]
  const contractStart = firstSprint?.start_date
  const contractEnd = lastSprint?.end_date
  
  // Days remaining in current sprint
  const today = new Date()
  const daysRemaining = activeSprint?.end_date 
    ? Math.max(0, differenceInDays(new Date(activeSprint.end_date), today))
    : 0
  
  // Total days across all sprints
  const totalContractDays = contractStart && contractEnd
    ? differenceInDays(new Date(contractEnd), new Date(contractStart))
    : 0

  // Contract KPI totals
  const totalKpiTarget = sprints?.reduce((sum, s) => sum + (s.kpi_target || 0), 0) || 0
  const totalKpiAchieved = sprints?.reduce((sum, s) => sum + (s.kpi_achieved || 0), 0) || 0
  const kpiProgress = totalKpiTarget > 0 ? (totalKpiAchieved / totalKpiTarget) * 100 : 0

  // Contract hours totals (monthly_hours * 3 per sprint for quarterly)
  const monthlyHours = client.monthly_hours || 0
  const totalBudgetHours = monthlyHours * 3 * totalSprints // 3 months per sprint
  const totalHoursUsed = timeEntries?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0
  const hoursProgress = totalBudgetHours > 0 ? (totalHoursUsed / totalBudgetHours) * 100 : 0
  const hoursUtilization = totalBudgetHours > 0 ? (totalHoursUsed / totalBudgetHours) * 100 : 0

  // Average billable rate
  const avgBillableRate = totalHoursUsed > 0 && client.agency_value
    ? client.agency_value / totalHoursUsed
    : null

  // Check if client has partial tracking (some sprints missing hours)
  const sprintsWithHours = sprints?.filter(s => hoursPerSprint[s.id] && hoursPerSprint[s.id] > 0).length || 0
  const hasPartialTracking = sprintsWithHours < totalSprints && sprintsWithHours > 0

  // Prepare sprint data for chart
  const sprintChartData = sprints?.map(s => ({
    name: `Sprint ${s.sprint_number || '?'}`,
    kpiTarget: s.kpi_target || 0,
    kpiAchieved: s.kpi_achieved || 0,
  })) || []

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" asChild className="mt-1">
              <Link href="/dashboard/clients">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {client.name}
                </h1>
                {client.is_active ? (
                  <Badge className="bg-green-500 text-white hover:bg-green-600">
                    ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    INACTIVE
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-600 dark:text-gray-400">
                  DPR Lead: {client.dpr_lead?.name || 'Not assigned'}
                </span>
                {hasPartialTracking && (
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    Partial tracking
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards - 3 column grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Financial Overview */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Financial Overview
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Agency Value</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${client.agency_value?.toLocaleString() || '—'}
                </p>
                <p className="text-xs text-gray-400">Total contract value</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Monthly Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${client.monthly_rate?.toLocaleString() || '—'}
                </p>
                <p className="text-xs text-gray-400">Per month</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Ideal Hourly Rate</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  $190/hr
                </p>
                <p className="text-xs text-gray-400">Standard rate (AUD)</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Avg. Billable Rate</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {avgBillableRate ? `$${Math.round(avgBillableRate)}/hr` : '—'}
                </p>
                <p className="text-xs text-gray-400">Across all tracked sprints</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contract Overview */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Contract Overview
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Contract Period</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {totalSprints} sprints
                </p>
                <p className="text-xs text-gray-400">
                  {contractStart && contractEnd 
                    ? `${format(new Date(contractStart), 'dd/MM/yyyy')} - ${format(new Date(contractEnd), 'dd/MM/yyyy')}`
                    : 'No dates available'
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Current Sprint</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  Sprint {currentSprintNumber} of {totalSprints}
                </p>
                <p className="text-xs text-gray-400">
                  {activeSprint 
                    ? `${format(new Date(activeSprint.start_date), 'dd/MM/yyyy')} - ${format(new Date(activeSprint.end_date), 'dd/MM/yyyy')}`
                    : 'No active sprint'
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Days Remaining</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {daysRemaining}
                </p>
                <p className="text-xs text-gray-400">{totalContractDays} total days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Performance Metrics
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Contract KPI Target</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalKpiTarget}
                </p>
                <p className="text-xs text-gray-400">Links across all sprints</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Current Progress</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(kpiProgress)}%
                </p>
                <p className="text-xs text-gray-400">{totalKpiAchieved} / {totalKpiTarget} links</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bars - 2 column grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Contract KPI Performance */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Contract KPI Performance
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              {totalKpiAchieved} / {totalKpiTarget}
            </p>
            <Progress 
              value={Math.min(kpiProgress, 100)} 
              className="h-3 mb-4"
            />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase">Achieved</p>
                <p className="font-semibold">{totalKpiAchieved} links</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Target</p>
                <p className="font-semibold">{totalKpiTarget} links</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Progress</p>
                <p className="font-semibold">{kpiProgress.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contract Hours Usage */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Contract Hours Usage
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              {totalHoursUsed.toFixed(1)} / {totalBudgetHours.toFixed(1)} hrs
            </p>
            <Progress 
              value={Math.min(hoursProgress, 100)} 
              className="h-3 mb-4"
            />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase">Used</p>
                <p className="font-semibold">{totalHoursUsed.toFixed(1)} hrs</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Budget</p>
                <p className="font-semibold">{totalBudgetHours.toFixed(1)} hrs</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Utilization</p>
                <p className="font-semibold">{hoursUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Performance Chart */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sprint Performance Overview
          </h3>
          <SprintPerformanceChart data={sprintChartData} />
        </CardContent>
      </Card>
    </div>
  )
}
