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
import { AllSprintsOverview } from '@/components/clients/all-sprints-overview'
import { SprintBreakdownTable } from '@/components/clients/sprint-breakdown-table'

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
    .select(`
      hours, 
      sprint_id, 
      entry_date, 
      description, 
      task_category, 
      user_id,
      users!time_entries_user_id_fkey(name)
    `)
    .eq('client_id', id)
    .order('entry_date', { ascending: false })

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

  // Total contract value (sum of all sprint revenues)
  // Each sprint revenue = monthly_rate * 3 (for quarterly sprints)
  // Falls back to client.monthly_rate if sprint.monthly_rate is not set
  const totalContractValue = sprints?.reduce((sum, s) => {
    const sprintMonthlyRate = s.monthly_rate || client.monthly_rate || 0
    const sprintRevenue = sprintMonthlyRate * 3
    return sum + sprintRevenue
  }, 0) || 0

  // Billable contract value (only completed + active sprints, excluding future)
  const billableContractValue = sprints?.reduce((sum, s) => {
    // Only include completed and active sprints, not pending/future ones
    if (s.status === 'pending') return sum
    
    const sprintMonthlyRate = s.monthly_rate || client.monthly_rate || 0
    const sprintRevenue = sprintMonthlyRate * 3
    return sum + sprintRevenue
  }, 0) || 0

  // Average billable rate (billable contract value / total hours used)
  // Only includes revenue from completed and active sprints
  const avgBillableRate = totalHoursUsed > 0 && billableContractValue > 0
    ? billableContractValue / totalHoursUsed
    : null

  // Check if client has partial tracking (sprints that started before Clockify tracking began on 2025-02-02)
  // Only flag as partial if sprints started before tracking date have missing hours
  const clockifyTrackingStartDate = new Date('2025-02-02')
  const sprintsBeforeTracking = sprints?.filter(s => new Date(s.start_date) < clockifyTrackingStartDate) || []
  const sprintsBeforeTrackingWithHours = sprintsBeforeTracking.filter(s => hoursPerSprint[s.id] && hoursPerSprint[s.id] > 0).length
  const hasPartialTracking = sprintsBeforeTracking.length > 0 && sprintsBeforeTrackingWithHours < sprintsBeforeTracking.length && sprintsBeforeTrackingWithHours > 0

  // Calculate hours logged outside of sprint dates (post-sprint, gaps, etc.)
  const hoursInSprints = Object.values(hoursPerSprint).reduce((sum, h) => sum + h, 0)
  const hoursOutsideSprints = totalHoursUsed - hoursInSprints
  
  // Get time entries outside of sprint dates
  const entriesOutsideSprints = timeEntries?.filter(entry => !entry.sprint_id) || []

  // Calculate task breakdown for all sprint work (entries within sprints)
  const entriesInSprints = timeEntries?.filter(entry => entry.sprint_id) || []
  const taskBreakdown: Record<string, number> = {}
  entriesInSprints.forEach(entry => {
    const category = entry.task_category || 'Uncategorized'
    taskBreakdown[category] = (taskBreakdown[category] || 0) + (entry.hours || 0)
  })
  
  // Sort task breakdown by hours (descending)
  const taskBreakdownSorted = Object.entries(taskBreakdown)
    .map(([category, hours]) => ({ category, hours }))
    .sort((a, b) => b.hours - a.hours)

  // Prepare sprint data for chart
  const sprintChartData = sprints?.map(s => ({
    name: `Sprint ${s.sprint_number || '?'}`,
    kpiTarget: s.kpi_target || 0,
    kpiAchieved: s.kpi_achieved || 0,
  })) || []

  // Prepare sprint data for All Sprints overview
  const sprintCardsData = sprints?.map(s => ({
    id: s.id,
    name: s.name,
    sprint_number: s.sprint_number,
    start_date: s.start_date,
    end_date: s.end_date,
    status: s.status,
    kpi_target: s.kpi_target || 0,
    kpi_achieved: s.kpi_achieved || 0,
    hours_used: hoursPerSprint[s.id] || 0,
    budget_hours: monthlyHours * 3, // 3 months per sprint
    monthly_rate: client.monthly_rate,
  })) || []

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Back Button */}
      <div className="flex gap-2 mb-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/clients">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Link>
        </Button>
      </div>

      {/* Hero Header Section */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            {client.name}
          </h1>
          {client.is_active ? (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-sm px-3 py-1">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">
              Inactive
            </Badge>
          )}
          {hasPartialTracking && (
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              Partial tracking
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-6 text-base text-gray-600 dark:text-gray-400">
          <span><strong>DPR Lead:</strong> {client.dpr_lead?.name || 'Not assigned'}</span>
          {client.campaign_type && (
            <>
              <span>•</span>
              <span>{client.campaign_type}</span>
            </>
          )}
          {contractStart && contractEnd && (
            <>
              <span>•</span>
              <span>{format(new Date(contractStart), 'MMM yyyy')} - {format(new Date(contractEnd), 'MMM yyyy')}</span>
            </>
          )}
        </div>
      </div>

      {/* Key Metrics - Clean Bubbles */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        {/* Total Agency Value */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Total Agency Value</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              ${totalContractValue?.toLocaleString() || '—'}
            </div>
            <div className="text-sm text-gray-600">SEO + DPR</div>
          </CardContent>
        </Card>

        {/* DPR Monthly Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">DPR Monthly Rate</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              ${client.monthly_rate?.toLocaleString() || '—'}
            </div>
            <div className="text-sm text-gray-600">{monthlyHours.toFixed(1)} hrs/mo</div>
          </CardContent>
        </Card>

        {/* Contract Type */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Contract Type</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {client.contract_length || 'N/A'}
            </div>
            <div className="text-sm text-gray-600">{totalSprints} sprints total</div>
          </CardContent>
        </Card>

        {/* Actual Billable Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Actual Billable Rate</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              ${avgBillableRate ? Math.round(avgBillableRate) : '—'}/hr
            </div>
            <div className={`text-sm font-semibold ${avgBillableRate && avgBillableRate >= 190 ? 'text-green-600' : 'text-orange-600'}`}>
              Target: $190/hr
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Sprint Bar */}
      <Card className="mb-8">
        <CardContent className="py-4">
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Current Sprint</div>
              <div className="text-lg font-bold text-gray-900">Sprint {currentSprintNumber} of {totalSprints}</div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Period</div>
              <div className="text-sm font-semibold text-gray-900">
                {activeSprint ? format(new Date(activeSprint.start_date), 'dd MMM') : '—'} - {activeSprint ? format(new Date(activeSprint.end_date), 'dd MMM yy') : '—'}
              </div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Days Remaining</div>
              <div className="text-lg font-bold text-gray-900">{daysRemaining} days</div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">KPI Target</div>
              <div className="text-lg font-bold text-gray-900">{activeSprint?.kpi_target || 0} links</div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Hours Budget</div>
              <div className="text-lg font-bold text-gray-900">{(monthlyHours * 3).toFixed(0)} hrs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout - Sprints to Date + Chart */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Sprints to Date */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Sprints to Date</h2>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-600">Sprint {currentSprintNumber} of {totalSprints}</span>
              <span className="text-sm font-semibold text-gray-900">{daysRemaining} days remaining</span>
            </div>
            
            <div className="space-y-6">
              {/* KPI Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">KPI Achievement</span>
                  <span className={`text-sm font-bold ${kpiProgress >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                    {kpiProgress.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(kpiProgress, 100)} className="h-3 [&>div]:bg-green-500" />
                <div className="text-xs text-gray-500 mt-1">{totalKpiAchieved} of {totalKpiTarget} links</div>
              </div>

              {/* Hours Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Hours Utilization</span>
                  <span className={`text-sm font-bold ${hoursUtilization > 100 ? 'text-red-600' : hoursUtilization > 80 ? 'text-amber-600' : 'text-green-600'}`}>
                    {hoursUtilization.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(hoursProgress, 100)} 
                  className={`h-3 ${hoursUtilization > 100 ? '[&>div]:bg-red-500' : hoursUtilization > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {totalHoursUsed.toFixed(0)} of {totalBudgetHours.toFixed(0)} hrs
                  {hoursOutsideSprints > 0 && (
                    <span className="text-orange-600"> ({hoursInSprints.toFixed(0)} in sprints + {hoursOutsideSprints.toFixed(0)} outside)</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Performance Trend</h2>
            <SprintPerformanceChart data={sprintChartData} />
          </CardContent>
        </Card>
      </div>

      {/* Sprints Table - Clean, Data-Dense */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Sprint Breakdown</h2>
          <SprintBreakdownTable sprints={sprintCardsData} />
        </CardContent>
      </Card>

      {/* Time Entries Outside Sprints - Only show if there are any */}
      {entriesOutsideSprints.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Time Logged Outside Sprint Dates
              </h2>
              <span className="text-sm font-semibold text-orange-600">
                {hoursOutsideSprints.toFixed(1)} hrs total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Task Category</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {entriesOutsideSprints.map((entry, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-orange-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {(entry.users as any)?.name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {entry.task_category || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-md truncate">
                        {entry.description || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                        {entry.hours.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-orange-50">
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                      Total Hours Outside Sprints:
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-orange-600 text-right">
                      {hoursOutsideSprints.toFixed(1)} hrs
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-sm text-orange-800">
                <strong>Note:</strong> These hours are logged to this client but fall outside of any sprint date ranges. 
                This could include post-sprint work, pre-sprint preparation outside the 14-day window, or work during gaps between sprints.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Breakdown for Sprint Work */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Task Breakdown (All Sprint Work)
            </h2>
            <span className="text-sm font-semibold text-gray-600">
              {hoursInSprints.toFixed(1)} hrs total
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Task Category</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Hours</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% of Total</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {taskBreakdownSorted.map((task, idx) => {
                  const percentage = hoursInSprints > 0 ? (task.hours / hoursInSprints) * 100 : 0
                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {task.category}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                        {task.hours.toFixed(1)} hrs
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {percentage.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Progress value={percentage} className="h-2 flex-1" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                    Total Sprint Hours:
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
                    {hoursInSprints.toFixed(1)} hrs
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">
                    100%
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
